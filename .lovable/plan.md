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

La documentación dejará constancia de que:

- localStorage tiene capacidad limitada y dependiente del navegador/entorno (sin asumir un límite exacto);
- el volumen esperado de Songs en esta fase es suficientemente pequeño para usarlo temporalmente;
- los errores de cuota se manejan como errores reales de persistencia (estado `Error al guardar`);
- IndexedDB será la solución local definitiva en su fase correspondiente.

## 3. Guardado: autoguardado con debounce (ADR-013)

- Cambios editados localmente de forma inmediata y marcados como `dirty`.
- Autoguardado tras ~600 ms de inactividad.
- Al hacer blur de un campo, flush inmediato si hay cambios pendientes.
- Flush de cambios pendientes antes de acciones que cambian de contexto (duplicar, eliminar).
- "Guardar al desmontar" NO se considera garantía de persistencia y no forma parte de la estrategia.
- Si guardar falla, se conserva el estado local del editor y se muestra `Error al guardar`.
- No se muestra `Guardado` hasta que el repository confirme la operación.

Estados visibles en el editor: `Cambios sin guardar`, `Guardando…`, `Guardado hh:mm`, `Error al guardar`.

No se implementa Undo, historial ni versionado; no se afirma que los cambios sean reversibles.

## 4. Labels automáticos de sección

Labels por defecto:

- verse → `Verso N` (numerado según la cantidad de versos existentes)
- chorus → `Coro`
- prechorus → `Pre-coro`
- bridge → `Puente`
- intro → `Intro`
- outro → `Outro`
- custom → label libre del usuario

Reglas:

- Al crear una sección se genera un label inicial razonable.
- Si el usuario modifica manualmente un label, reordenamientos posteriores NO lo sobrescriben.
- Mover una sección solo cambia `order`, nunca su label.
- Cambiar el tipo solo sugiere un nuevo label si el anterior todavía era el generado automáticamente.
- No se implementa renumeración de labels personalizados.
- El array normaliza exclusivamente `order` a `0..n-1`.

## 5. `/songs` — biblioteca

`_app.songs.tsx` pasa a ser layout con `<Outlet />`; el listado vive en `_app.songs.index.tsx`.

- Sin canciones: empty state compacto "No hay canciones todavía" + acción `Crear canción`.
- Con canciones: tabla densa (título, autor, última modificación, menú de acciones: abrir / duplicar / eliminar).
- Buscador por título y autor, y botón `Crear canción` en la cabecera.
- Crear pide solo `Título` y `Autor` (opcional) en un diálogo; al confirmar navega directo al editor.

## 6. `/songs/$songId` — editor

Ruta `_app.songs.$songId.tsx`:

- Cabecera: campos de título y autor en línea, fechas de creación/modificación, indicador de estado de guardado, acciones duplicar/eliminar.
- Cuerpo: lista de secciones; cada una con selector de tipo, campo de label, textarea de contenido (multilínea, tipografía legible), botones subir/bajar y eliminar con confirmación.
- Pie: `Añadir sección` (por defecto `verse` con label autonumerado).
- Canción inexistente: estado claro con vuelta a la biblioteca.

Reordenamiento con **botones subir/bajar**, sin drag & drop y sin dependencias nuevas.

## 7. Duplicación

Regla de dominio (no en el repository): nuevo `id` de canción, **nuevo `id` para cada sección**, arreglo de secciones copiado sin referencias compartidas, sufijo ` — copia`, fechas nuevas.

## 8. Validaciones

- Título: obligatorio, `trim`, máximo 120 caracteres.
- Label de sección: si queda vacío se repone el label por defecto del tipo (no bloquea el guardado).
- Contenido: puede estar vacío y admite saltos de línea.
- `order` se normaliza siempre a 0..n-1 tras añadir, eliminar o mover.

## 9. Estado

Contexto acotado a la sección: `SongsProvider` montado en el layout `_app.songs.tsx`, no en el App Shell. Sin Zustand ni dependencias nuevas.

## 10. Tests (`bun test`, patrón de Projects)

Dominio: creación, validación de título, renombrado, duplicación con IDs nuevos de sección, añadir/editar/eliminar sección, reordenar y normalización de `order`, labels automáticos (numeración de versos, no sobrescritura de labels personalizados).
Servicio/repositorio: persistencia temporal, lectura tras recarga y recuperación ante datos inválidos.

## 11. Archivos

Crear: `src/domain/songs/song.ts`, `src/domain/songs/song-rules.ts`, `src/services/songs/song-repository.ts`, `src/services/songs/local-storage-song-repository.ts`, `src/features/songs/song-service.ts`, `src/features/songs/songs-context.tsx`, componentes `song-dialog.tsx`, `song-actions.tsx`, `song-row.tsx`, `song-list.tsx`, `song-section-editor.tsx`, rutas `_app.songs.index.tsx` y `_app.songs.$songId.tsx`, tests `tests/domain/song-rules.test.ts` y `tests/services/local-storage-song-repository.test.ts`.

Modificar: `src/routes/_app.songs.tsx` (layout + provider), `docs/ROADMAP.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md` (ADR-012 y ADR-013), `docs/TESTING.md` (nivel Songs).

No se tocan `package.json`, `bun.lock` ni `src/routeTree.gen.ts`.

## 12. Fuera de alcance

Añadir canciones a Projects, rundown, slides, Presentation Engine, Live, Outputs, Bible, Media, Presets, PWA, IndexedDB, Supabase, sync, remote, importación de letras externas, Undo/historial/versionado.

## 13. Decisiones registradas

1. Secciones embebidas en `Song` (ADR-012).
2. Tipos `prechorus` y `outro` en lugar de `ending`.
3. Autoguardado con debounce, flush en blur y antes de acciones de contexto; sin depender del unmount (ADR-013).
4. `tags`, `favorite` y `presetId` diferidos.
5. `localStorage` temporal con capacidad limitada documentada; IndexedDB en su fase.
