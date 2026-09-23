# Fase 10 — Media (imágenes y videos locales, offline)

Nota: el mensaje llegó cortado en la definición de `MediaFileStorage`. El plan cubre los puntos 1 y 2 recibidos y propone el resto; si había más requisitos (formatos, límites, controles de video), se incorporan antes de ejecutar.

## Qué va a poder hacer el operador

- Importar imágenes (JPG, PNG, WebP, GIF) y videos (MP4, WebM) desde la computadora en `/media`.
- La app guarda su propia copia: mover o borrar el original, cerrar el navegador o reiniciar la PC no rompe nada. Sin Internet.
- Ver la biblioteca en `/media` con miniatura, nombre, tipo, tamaño, resolución y duración; renombrar y eliminar.
- Buscar Media desde el Library Dock de Live (nueva pestaña Media) y usar "+ Rundown" o "Al aire", igual que Songs y Bible.
- Un clic en la slide de Media la envía al aire (misma regla que el resto). Clear y Black funcionan igual.
- Los videos se reproducen en Program (silenciado, como monitor) y en Output (con sonido). Controles en Live: reproducir/pausar, reiniciar, bucle.
- Espacio usado visible en `/media` (estimación del navegador) y aviso claro si no hay espacio.

## Arquitectura

```text
Archivo  ->  validar (tipo, tamaño, lectura de dimensiones/duración)
         ->  MediaFileStorage.save(id, blob)      (archivo físico: OPFS)
         ->  MediaRepository.put(meta)            (metadata: IndexedDB)
         ->  MediaService / MediaProvider (React)
         ->  RundownItem { type: "media", sourceId: mediaId, title }
         ->  PresentationItem con 1 slide { content: { kind: "media", mediaId, mediaType } }
         ->  Live (snapshot)  ->  OutputSnapshot lleva mediaId, nunca bytes
         ->  /output/main resuelve mediaId -> URL local en SU propia ventana
```

Decisiones clave:
1. **Archivo separado de la metadata.** Metadata en IndexedDB (`broadcast-control.media`, store `assets`). Bytes en OPFS (`media/<id>`). Nada en localStorage, base64 ni dentro del Project.
2. **Abstracción de almacenamiento** para el futuro `.exe`:
   ```ts
   interface MediaFileStorage {
     save(id: string, file: Blob): Promise<void>;
     get(id: string): Promise<Blob | null>;
     delete(id: string): Promise<void>;
     exists(id: string): Promise<boolean>;
     getUrl(id: string): Promise<MediaUrlHandle | null>; // { url, release() }
     estimate?(): Promise<{ usage: number; quota: number } | null>;
   }
   ```
   Implementaciones: `OpfsMediaStorage` (producción), `IndexedDbBlobMediaStorage` (respaldo si OPFS no existe, p. ej. Safari antiguo), `InMemoryMediaStorage` (tests). Un futuro `NativeFileSystemMediaStorage` devuelve `file://`/`asset://` en `getUrl`. UI, dominio, Project, Live y Output solo conocen la interfaz.
3. **URLs por ventana.** Un `blob:` no cruza ventanas, así que Output no recibe URLs: recibe `mediaId` y pide su propia URL al storage (mismo origen, mismo OPFS). Un caché con conteo de referencias libera las URLs al dejar de usarse.
4. **Media es referencia, no copia** (a diferencia de Bible, ADR-042): el Project guarda `sourceId`. Si el archivo se elimina de la biblioteca, el item queda como "Contenido faltante" (ADR-020) y Output muestra fondo base, nunca un error. Eliminar un archivo usado muestra advertencia con los Projects que lo usan.
5. **Snapshot de Live**: al cargar/agregar, el item Media congela `mediaId`, tipo y metadata mínima; no lee bytes. Alta incremental reutiliza `appendToLiveSession`; quitar el item al aire reutiliza `detachedProgramSlide` (la copia conserva `mediaId`, así Output no parpadea).
6. **Reproducción de video**: estado `playback { state: "playing"|"paused", startedAt, offset, loop }` viaja en el OutputSnapshot solo para slides de video. Output reproduce con sonido; Program en Live, silenciado. Sincronía "suficiente" (recalcula posición al recibir cambios), no frame-perfect.
7. **Presets (futuro)**: `PresetStyle.background` ya es unión discriminada; se deja preparado `{ type: "media"; mediaId }` en el tipo del dominio pero sin UI ni uso en esta fase.

## Archivos

Nuevos:
- `src/domain/media/media.ts` (MediaAsset, tipos permitidos, límites), `media-rules.ts` (validación, búsqueda, uso en Projects).
- `src/services/media/media-file-storage.ts` (interfaz), `opfs-media-storage.ts`, `indexeddb-blob-media-storage.ts`, `in-memory-media-storage.ts`, `media-repository.ts` + `indexeddb-media-repository.ts`, `media-url-cache.ts`.
- `src/features/media/media-service.ts`, `media-context.tsx` (MediaProvider en `_app.tsx`), `read-media-info.ts` (dimensiones/duración/miniatura vía `<img>`/`<video>`, solo cliente), componentes `media-import-button`, `media-grid`, `media-card`, `media-thumbnail`.
- `src/features/live/components/library-media-tab.tsx`, `live-video-controls.tsx`.
- `src/features/presentation/components/media-renderer.tsx` (usado por SlideRenderer, Program y Output).

Modificados:
- `src/routes/_app.media.tsx` (biblioteca real), `rundown-rules.ts` (`addMediaToRundown`), `projects-context.tsx` (`addMediaToProject`), `presentation.ts` (`SlideContent` gana `kind: "media"`), `project-to-presentation.ts` + nuevo `media-to-presentation.ts`, `live-session.ts` (fuente media), `live-library-dock.tsx` (pestaña Media), `_app.live.tsx`, `output-snapshot.ts` (slide media + playback, validación y comparación), `output-surface.tsx`, `slide-surface.tsx`, `live-slide-grid.tsx` (miniatura), `local-storage-project-repository.ts` (acepta items media).
- Docs: DECISIONS (ADRs de almacenamiento, referencia vs copia, URLs por ventana, playback), DATA_MODEL, ARCHITECTURE, OFFLINE_STRATEGY, TESTING, ROADMAP, roadmap.md.

## Tests

- Storage: contrato común corrido contra InMemory e IndexedDbBlob (save/get/exists/delete/getUrl/release).
- Repository: put/list/delete; eliminar asset borra archivo y metadata sin huérfanos.
- Validación: tipo no permitido, archivo vacío, tamaño excesivo, nombre saneado.
- Rundown: agregar/quitar media, orden normalizado, eliminar asset no toca Projects, item faltante como placeholder.
- Presentación: media -> 1 slide con mediaId; goLive/TAKE/Clear/Black con media; quitar item media al aire conserva la salida.
- OutputSnapshot: serializa mediaId y playback, rechaza mensajes corruptos, igualdad.
- Navegador: importar imagen y video reales, recargar la página y seguir viéndolos, agregar al rundown, al aire, Output muestra y reproduce, 1366×768 y 1920×1080 sin scroll global, consola limpia.

## Riesgos

- Cuota del navegador: videos grandes pueden agotarla; se valida antes de copiar y se limpia el archivo parcial si falla.
- OPFS sin `createWritable` en algunos navegadores: se usa respaldo IndexedDB.
- Fugas de memoria por URLs no liberadas: caché con conteo de referencias.
- Autoplay con sonido en Output puede ser bloqueado hasta un gesto; "Iniciar salida" ya provee ese gesto.
- SSR: OPFS, IndexedDB y `<video>` solo tras montaje.

## Fuera de alcance

Audio, logos, fondos de Preset en uso, presentaciones (PPT/PDF), recorte/edición, streaming, sincronización en la nube, Stage, drag & drop, `.exe`.
