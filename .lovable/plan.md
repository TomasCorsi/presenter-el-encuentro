# Fase 3 — Songs

Biblioteca local de canciones con editor de secciones, siguiendo exactamente el patrón aprobado en Projects (UI → feature/service → repository → adaptador local).

## 1. Modelo

`Song` guarda sus secciones **embebidas** (no `sectionIds` sueltos): una canción se lee, guarda y duplica siempre como una unidad, y no hay todavía almacén de secciones independiente. Esto requiere actualizar `DATA_MODEL.md` y registrar **ADR-012 — Song como documento con secciones embebidas**.

```ts
type SongSectionType = "verse" | "chorus" | "prechorus" | "bridge" | "intro" | "outro" | "custom";

interface SongSection { id: string; type: SongSectionType; label: string; content: string; order: number; }

interface Song {
  id: string; workspaceId: string; title: string; author?: string;
  sections: SongSection[]; createdAt: string; updatedAt: string;
}
```

Cambios frente al documento actual: se añaden `prechorus` y `outro`, se descarta `ending`, y se posponen `tags`, `favorite` y `presetId` (no los pide esta fase).

## 2. Persistencia temporal

Se mantiene `localStorage` con clave versionada `broadcast-control.songs.v1`, parseo defensivo y recuperación a estado vacío ante datos inválidos, igual que Projects.

Evaluación pedida: una letra típica ocupa 1–3 KB; con ~500 canciones son ~1,5 MB, dentro del límite habitual de 5 MB. No justifica adelantar IndexedDB en esta fase, y la interfaz `SongRepository` permite cambiar el adaptador sin tocar UI ni reglas. Riesgo anotado: bibliotecas muy grandes (>1000 canciones) o letras largas acercan el límite; se revisará en la fase de IndexedDB.

## 3. Guardado: autoguardado con debounce (recomendado)

Se propone **autoguardado** (~600 ms de inactividad + guardado inmediato al salir del campo y al desmontar), con indicador de estado "Guardando… / Guardado hh:mm" en el encabezado del editor. Motivo: es una herramienta de producción en vivo; un botón `Guardar` olvidado pierde trabajo justo antes de un evento. El riesgo de autoguardado (escribir basura) es bajo porque la validación bloquea solo el título vacío y todo queda local y reversible manualmente.

## 4. `/songs` — biblioteca

`_app.songs.tsx` pasa a ser layout con `<Outlet />`; el listado vive en `_app.songs.index.tsx`.

- Sin canciones: empty state compacto "No hay canciones todavía" + acción `Crear canción`.
- Con canciones: tabla densa (título, autor, última modificación, menú de acciones: abrir / duplicar / eliminar).
- Buscador por título y autor, y botón `Crear canción` en la cabecera.
- Crear pide solo `Título` y `Autor` (opcional) en un diálogo; al confirmar navega directo al editor.

## 5. `/songs/$songId` — editor

Ruta `_app.songs.$songId.tsx`:

- Cabecera: campos de título y autor en línea, fechas de creación/modificación, estado de guardado, acciones duplicar/eliminar.
- Cuerpo: lista de secciones; cada una con selector de tipo, campo de label, textarea de contenido (multilínea, tipografía legible), botones subir/bajar y eliminar con confirmación.
- Pie: `Añadir sección` (por defecto `verse` con label autonumerado, p. ej. "Verso 2").
- Canción inexistente: estado claro con vuelta a la biblioteca.

Reordenamiento con **botones subir/bajar**, sin drag & drop y sin dependencias nuevas.

## 6. Duplicación

Regla de dominio (no en el repository): nuevo `id` de canción, **nuevo `id` para cada sección**, arreglo de secciones copiado sin referencias compartidas, sufijo ` — copia`, fechas nuevas.

## 7. Validaciones

- Título: obligatorio, `trim`, máximo 120 caracteres.
- Label de sección: si queda vacío se repone el label por defecto del tipo (no bloquea el guardado).
- Contenido: puede estar vacío y admite saltos de línea.
- `order` se normaliza siempre a 0..n-1 tras añadir, eliminar o mover.

## 8. Estado

Contexto acotado a la sección: `SongsProvider` montado en el layout `_app.songs.tsx`, no en el App Shell. Sin Zustand ni dependencias nuevas.

## 9. Tests (`bun test`, patrón de Projects)

Dominio: creación, validación de título, renombrado, duplicación con IDs nuevos de sección, añadir/editar/eliminar sección, reordenar y normalización de `order`.
Servicio/repositorio: persistencia temporal, lectura tras recarga y recuperación ante datos inválidos.

## 10. Archivos

Crear: `src/domain/songs/song.ts`, `src/domain/songs/song-rules.ts`, `src/services/songs/song-repository.ts`, `src/services/songs/local-storage-song-repository.ts`, `src/features/songs/song-service.ts`, `src/features/songs/songs-context.tsx`, componentes `song-dialog.tsx`, `song-actions.tsx`, `song-row.tsx`, `song-list.tsx`, `song-section-editor.tsx`, rutas `_app.songs.index.tsx` y `_app.songs.$songId.tsx`, tests `tests/domain/song-rules.test.ts` y `tests/services/local-storage-song-repository.test.ts`.

Modificar: `src/routes/_app.songs.tsx` (layout + provider), `docs/ROADMAP.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md` (ADR-012 y ADR-013 de autoguardado), `docs/TESTING.md` (nivel Songs).

No se tocan `package.json`, `bun.lock` ni `src/routeTree.gen.ts`.

## 11. Fuera de alcance

Añadir canciones a Projects, rundown, slides, Presentation Engine, Live, Outputs, Bible, Media, Presets, PWA, IndexedDB, Supabase, sync, remote e importación de letras externas.

## 12. Decisiones que requieren tu aprobación

1. Secciones embebidas en `Song` (cambia `DATA_MODEL.md`, ADR-012).
2. Tipos `prechorus` y `outro` en lugar de `ending`.
3. Autoguardado con debounce en vez de botón `Guardar` (ADR-013).
4. Posponer `tags`, `favorite` y `presetId`.
5. Mantener `localStorage` en esta fase, revisando el límite en la fase de IndexedDB.
