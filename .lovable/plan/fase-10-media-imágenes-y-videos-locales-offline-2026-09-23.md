# Fase 10 — Media (imágenes y videos locales, offline)

Media se implementa como CONTENIDO PRESENTABLE. Presets no cambian: background sigue siendo solo `solid`.

## Qué va a poder hacer el operador

- Importar imágenes (PNG, JPEG, WEBP; sin GIF en esta fase) y videos (MP4, WebM) desde la computadora en `/media`.
- La app guarda su propia copia: mover o borrar el original, cerrar el navegador o reiniciar la PC no rompe nada. Sin Internet.
- Ver la biblioteca en `/media` con miniatura, nombre, tipo, tamaño, resolución y duración; renombrar y eliminar.
- Eliminar solo si el archivo no se usa: si está en uso, se bloquea con "Este archivo está utilizado por X elementos en Y proyectos."
- Buscar Media desde el Library Dock de Live (pestaña Media) con "+ Rundown" o "Al aire", igual que Songs y Bible.
- Un clic en la slide de Media la envía al aire. Clear y Black funcionan igual.
- Videos en Program (silenciado, como monitor) y en Output (con sonido). Controles en Live: reproducir/pausar, reiniciar, bucle.
- En `/media`: espacio usado/disponible y estado de "almacenamiento persistente" (concedido / no concedido / no soportado).

## Arquitectura

```text
Archivo -> MediaService.importMedia
             1 validar tipo/tamaño
             2 leer metadata (URL temporal sobre el File, luego revoke)
             3 comprobar espacio (storage.estimate) y elegir storage permitido
             4 MediaFileStorage.save(id, file)  -- streaming
             5 MediaFileStorage.exists(id) + tamaño coincide
             6 MediaRepository.put(meta)
             7 completar
           compensación: si falla 5 o 6 -> MediaFileStorage.delete(id)
        -> RundownItem { type: "media", sourceId: mediaId, title }
        -> PresentationItem con 1 slide { kind: "image" | "video", mediaId }
        -> Live (snapshot)  -> OutputSnapshot lleva mediaId, nunca bytes
        -> /output/main resuelve mediaId -> URL local en SU propia ventana
```

### Capas estrictamente separadas
- **MediaRepository**: solo metadata en IndexedDB (`broadcast-control.media`, store `assets`). No conoce bytes.
- **MediaFileStorage**: solo bytes. No conoce metadata ni Projects.
- **MediaService**: único coordinador de operaciones que tocan ambas capas (importar, eliminar, reparar). La UI solo habla con MediaService (vía MediaProvider).

```ts
interface MediaFileStorage {
  readonly kind: "opfs" | "indexeddb-blob" | "memory"; // futuro: "native"
  save(id: string, file: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  getUrl(id: string): Promise<MediaUrlHandle | null>; // { url, release() }
}
```
Implementaciones: `OpfsMediaStorage` (principal), `IndexedDbBlobMediaStorage` (respaldo limitado), `InMemoryMediaStorage` (tests). Un futuro `NativeFileSystemMediaStorage` (.exe) solo implementa la interfaz; UI, dominio, Project, Live y Output no conocen OPFS.

### Importación compensable (sin transacción única)
OPFS e IndexedDB no comparten transacción. Reglas:
- Falla antes de guardar el archivo -> no se crea metadata.
- Falla después de escribir el archivo pero antes de la metadata -> se borra el archivo (compensación). Si la compensación también falla, se informa el error (no se oculta) y queda registrado como huérfano reparable.
- Escritura OPFS en archivo temporal (`<id>.part`) y renombrado/confirmación al final cuando el navegador lo permita, para no dejar archivos a medias con nombre válido.

### Eliminación
`MediaService.deleteMedia(id)`:
1. calcular uso en todos los Projects; si > 0 -> error de dominio `MediaInUse { items, projects }`, nada se borra;
2. `MediaRepository.delete(id)` primero (el asset deja de ser visible/usable);
3. `MediaFileStorage.delete(id)`; si falla, el error se muestra al usuario y el archivo queda como huérfano (bytes sin metadata, inofensivo para la app).
Orden elegido: nunca queda metadata apuntando a un archivo inexistente.

### Reparación defensiva mínima
Al montar MediaProvider: listar metadata y verificar `exists` de forma perezosa; un asset sin archivo se marca "Archivo no disponible" (no se borra solo). No se construye un sistema de limpieza de huérfanos en esta fase; se documenta como mejora futura.

### Archivos grandes: sin cargar en memoria
- Escritura: `file.stream().pipeTo(await handle.createWritable())`. Nunca `file.arrayBuffer()`.
- Metadata: `URL.createObjectURL(file)` en un `<video>`/`<img>` temporal (`preload="metadata"`) para duración, dimensiones y miniatura (un frame a canvas, miniatura pequeña JPEG guardada en metadata), luego `revokeObjectURL`.
- Reproducción: `getUrl` usa `File` de OPFS (`getFile()`), que el navegador lee bajo demanda.
- Si OPFS no tiene `createWritable` en el contexto principal, se considera OPFS no disponible para videos.

### Respaldo IndexedDB limitado
- Imágenes: permitidas en IndexedDB Blob si no hay OPFS.
- Videos: si no hay OPFS con escritura en streaming, se rechaza con mensaje claro ("Este navegador no permite guardar videos localmente. Usá Chrome o Edge actualizados.").
- Justificación: guardar un Blob en IndexedDB suele requerir materializarlo y no garantiza escritura en streaming; el criterio es la capacidad (streaming), no un número arbitrario. Además, toda importación verifica `estimate()` (quota - usage) contra el tamaño del archivo con margen.

### Persistencia del almacenamiento
- Al primer uso/importación de Media: `navigator.storage.persisted()`; si es false, `navigator.storage.persist()`.
- No bloquea la importación si se deniega; el estado se muestra en `/media`.
- `navigator.storage.estimate()` para usage/quota.
- Todo detrás de un pequeño servicio `storage-persistence.ts` con feature detection.

### Contenido de slide
```ts
type SlideContent =
  | { kind: "text"; lines: string[] }
  | { kind: "image"; mediaId: string }
  | { kind: "video"; mediaId: string };
```
Los consumidores (renderer, grilla, Output, snapshot) hacen `switch` exhaustivo sobre `kind`.

### Live y Output
- Snapshot de Live: el item Media congela `mediaId`, tipo y título; no lee bytes. Alta incremental con `appendToLiveSession`; quitar el item al aire reutiliza `detachedProgramSlide` (conserva `mediaId`; Output no parpadea).
- Media es referencia (no copia como Bible). Como no se permite eliminar media en uso, no se crean Projects rotos; si aun así falta el archivo (datos del sitio borrados), el item se muestra como "Contenido faltante" y Output pinta fondo base.
- Un `blob:` no cruza ventanas: Output recibe `mediaId` y pide su propia URL al storage; caché con conteo de referencias libera las URLs.
- Video: Live es la autoridad. El OutputSnapshot lleva, solo para slides de video:
  ```ts
  interface VideoPlaybackState {
    state: "playing" | "paused";
    offsetSeconds: number;    // posición en el instante changedAtEpochMs
    changedAtEpochMs: number; // Date.now() de Live al cambiar el estado
    loop: boolean;
    revision: number;         // incremental; Output ignora revisiones viejas
  }
  ```
  Posición esperada = playing ? offsetSeconds + (now - changedAtEpochMs)/1000 : offsetSeconds (con módulo de duración si loop). Output recuperable: al abrir tarde o recargar, calcula la posición y salta ahí; corrige deriva solo si supera ~0,5 s.

## Archivos

Nuevos:
- `src/domain/media/media.ts` (MediaAsset, tipos, políticas), `media-rules.ts` (validación, búsqueda, `findMediaUsage`).
- `src/services/media/media-file-storage.ts`, `opfs-media-storage.ts`, `indexeddb-blob-media-storage.ts`, `in-memory-media-storage.ts`, `media-repository.ts`, `indexeddb-media-repository.ts`, `in-memory-media-repository.ts`, `media-url-cache.ts`, `storage-persistence.ts`.
- `src/features/media/media-service.ts`, `media-context.tsx` (MediaProvider en `_app.tsx`), `read-media-info.ts`, componentes `media-import-button`, `media-grid`, `media-card`, `media-thumbnail`, `media-storage-status`.
- `src/features/live/components/library-media-tab.tsx`, `live-video-controls.tsx`.
- `src/features/presentation/components/media-renderer.tsx`.

Modificados:
- `src/routes/_app.media.tsx`, `rundown-rules.ts` (`addMediaToRundown`), `projects-context.tsx` (`addMediaToProject`), `presentation.ts` (unión SlideContent), `project-to-presentation.ts` + `media-to-presentation.ts`, `live-session.ts`, `live-library-dock.tsx`, `_app.live.tsx`, `output-snapshot.ts`, `output-surface.tsx`, `slide-renderer.tsx`, `slide-surface.tsx`, `live-slide-grid.tsx`, `local-storage-project-repository.ts`, consumidores de `content.lines` adaptados al switch.
- Sin cambios en el dominio de Presets.
- Docs: DECISIONS (almacenamiento separado, importación compensable, bloqueo de eliminación en uso, URLs por ventana, respaldo limitado, persistencia), DATA_MODEL, ARCHITECTURE, OFFLINE_STRATEGY (persist/persisted/estimate y límites reales de persistencia: sobrevive a cierres y reinicios; se pierde si se borran los datos del sitio; depende de políticas del navegador; persistent storage reduce el riesgo de eviction; mejora con app desktop), TESTING, ROADMAP, roadmap.md.

## Tests

- MediaFileStorage: contrato común contra InMemory e IndexedDbBlob (save/get/exists/delete/getUrl/release).
- MediaRepository: put/get/list/delete solo de metadata.
- MediaService importación: éxito; falla de validación no escribe nada; falla al guardar metadata borra el archivo; falla de compensación se reporta; video sin OPFS se rechaza; imagen sin OPFS usa IndexedDB; espacio insuficiente se rechaza.
- MediaService eliminación: sin uso elimina metadata y archivo; con uso se bloquea con conteo de items y proyectos correctos; falla al borrar archivo se reporta.
- Persistencia: persist se solicita una vez; denegado no bloquea; sin API -> "no soportado".
- Rundown/presentación: agregar/quitar media, orden normalizado, media -> 1 slide `image`/`video`; goLive/TAKE/Clear/Black; quitar item al aire conserva la salida.
- OutputSnapshot: serializa `image`/`video` + playback, rechaza mensajes corruptos, igualdad.
- Navegador: importar imagen y un video razonablemente grande (cientos de MB) vigilando memoria, recargar y seguir viéndolos, rundown, al aire, Output reproduce, intento de eliminar media en uso bloqueado, 1366×768 y 1920×1080 sin scroll global, consola limpia.

## Riesgos

- Cuota del navegador con videos grandes: validación previa y compensación.
- Soporte desigual de OPFS/`createWritable`: detección y mensaje claro.
- Fugas de URLs: caché con conteo de referencias.
- Autoplay con sonido en Output: "Iniciar salida" provee el gesto.
- SSR: OPFS, IndexedDB, storage API y `<video>` solo tras montaje.

## Fuera de alcance

Fondos de Preset (imagen/video), audio, logos, PPT/PDF, reemplazar media, eliminar de todos, localizar contenido faltante, limpieza automática de huérfanos, edición, nube, Stage, drag & drop, `.exe`.
