# Fase 5 — Project Rundown / Composition

Renumeración documental: esta fase pasa a ser **Fase 5**, y las posteriores se desplazan (Fase 6 — Live Mode, Fase 7 — Main Output, Fase 8 — Presets, Fase 9 — Bible, Fase 10 — Media, Fase 11 — Stage + Stream, Fase 12 — PWA + Offline, Fase 13 — Supabase, Fase 14 — Sync Engine, Fase 15 — Backups, Fase 16 — Mobile Remote, Fase 17 — Optimización). No cambia el alcance funcional.

Conectar Projects + Songs + Presentation Engine. El Project pasa a tener un rundown real, ordenado y repetible. Sin Live, sin outputs, sin nuevas dependencias.

## 1. Modelo de RundownItem

```ts
type RundownItemType = "song" | "bible" | "media" | "presentation" | "countdown" | "message"

interface RundownItem {
  id: string            // identidad de ESTA instancia dentro del project
  type: RundownItemType // en esta fase solo se crea "song"
  sourceId: string      // song.id
  title: string         // snapshot del título al agregar (fallback si la Song desaparece)
  order: number         // normalizado a 0..n-1
}
```

El tipo union completo se declara ahora (cero coste), pero solo `song` se puede crear, resolver y presentar. `title` se guarda como snapshot: sirve para mostrar referencias rotas sin inventar contenido. El título mostrado prioriza siempre la Song viva; el snapshot es fallback.

## 2. Embebido, no persistencia separada (opción B)

`rundown: RundownItem[]` vive dentro de `Project`.

Motivos: coherencia con Songs (secciones embebidas, ADR-012); el rundown no tiene vida fuera de su project; duplicar un Project duplica el rundown sin joins; reordenar es una única escritura atómica; `RundownItem.id` es de instancia, así que no hay entidad compartida que normalizar.

`itemIds` queda **eliminado** del modelo: era un placeholder nunca usado (siempre `[]`) y mantener dos listas de orden garantiza desincronización. La migración lo descarta explícitamente.

## 3. Migración de Projects existentes

La clave sube a `broadcast-control.projects.v2`, sin borrar la v1.

Lectura:
1. Si existe `v2`, se lee normalmente.
2. Si no existe `v2` pero sí `v1`, se migra en memoria: cada Project recibe `rundown: []`, se descarta `itemIds`, se conserva id, nombre, fechas y `activeProjectId`. El resultado se escribe en `v2`.
3. La clave `v1` **no se borra** en esta fase: queda como respaldo por si la migración necesita revisarse. Se documenta que una fase posterior la limpiará.
4. Datos corruptos o versión desconocida → estado vacío, como hoy (nunca excepción).

Por proyecto, la validación es defensiva y no destructiva a nivel de lista: un `rundown` ausente o no-array pasa a `[]`; los items inválidos individuales se descartan y el resto del rundown se conserva; `order` se renormaliza siempre a 0..n-1 al leer.

## 4. `/projects/$projectId` como pantalla de preparación

Layout de dos columnas en escritorio, densidad broadcast:

```text
+-------------------+--------------------------------------+
| Biblioteca        | Rundown — Nombre del proyecto        |
| [buscar canción]  | 1  Bienvenida        song   ··· ^ v x|
| Grande y Fuerte + | 2  Grande y Fuerte   song   ··· ^ v x|
| Santo por Siempre+| 3  Santo por Siempre song   ··· ^ v x|
| ...               | 4  (contenido faltante)     ··· ^ v x|
+-------------------+--------------------------------------+
```

- Panel izquierdo fijo (~320 px): buscador por título y autor sobre la biblioteca de Songs, lista compacta, botón "Agregar" por fila. Sin salir de la pantalla, sin diálogo modal: es la acción principal y repetitiva de esta pantalla, así que un panel persistente gana a dialog/command palette (menos clics, permite agregar varias seguidas).
- En pantallas estrechas el panel colapsa a un drawer accesible desde "Agregar contenido".
- Columna central: rundown con posición, título, badge de tipo, indicador de origen (autor de la Song, o "Contenido faltante") y acciones subir/bajar/eliminar. `Página` en modo `full`.
- Encabezado del proyecto (nombre, fechas, marcar activo) se mantiene, compactado.

## 5. Agregar, repetir, reordenar, eliminar

- Agregar: crea `RundownItem` con `id` nuevo (`crypto.randomUUID()`), `sourceId = song.id`, `title` snapshot, al final, y renormaliza `order`. La Song no se modifica.
- Repetir: agregar dos veces la misma Song produce dos items con el mismo `sourceId` y distinto `id`. No hay deduplicación en ningún punto.
- Reordenar: botones subir/bajar, como en las secciones de Song. Drag & drop se descarta en esta fase: requeriría dependencia nueva o un implementación a medida con coste de accesibilidad; se evalúa en Fase 5 junto con la UI Live.
- Eliminar: quita solo esa instancia y renormaliza `order`. Confirmación ligera (la acción es de bajo riesgo y reversible re-agregando).

## 6. Referencias rotas

Un `RundownItem` cuyo `sourceId` no existe en la biblioteca:

- se conserva en el project (nunca se borra automáticamente);
- se muestra con el título snapshot y un estado explícito "Contenido faltante";
- se puede mover y eliminar manualmente;
- no genera contenido inventado.

En la conversión a presentación se representa como un `PresentationItem` sin slides (`slides: []`), que el motor ya sabe saltar (semántica de items vacíos de Fase 4). Así el rundown y la presentación conservan la misma numeración de posiciones.

## 7. Eliminar una Song usada en projects

Estrategia aprobada por preferencia del usuario: **advertir, no bloquear**.

Al eliminar una Song, el diálogo de confirmación indica en cuántos proyectos está en uso y los nombra (hasta unos pocos). Si el usuario confirma, la Song se elimina y las referencias quedan rotas, visibles como "Contenido faltante". Bloquear obligaría a editar proyectos antiguos solo para limpiar la biblioteca; borrar en cascada destruiría trabajo del usuario en silencio.

El cálculo de uso es una función pura de dominio sobre los projects cargados; Songs no adquiere dependencia de la persistencia de Projects (el recuento se pasa desde la capa de feature).

## 8. Rundown → PresentationItems

Función pura, sin React ni repositorios:

```ts
projectToPresentation(project: Project, songs: readonly Song[]): PresentationItem[]
```

- Respeta el orden del rundown (0..n-1).
- Para `type: "song"` con Song existente: `songToPresentationItem(song, { itemId: item.id, order: item.order })` — cero duplicación de lógica.
- Para referencia rota o tipo aún no implementado: item con `slides: []`, `title` snapshot, `sourceId` y `order` conservados.

La UI de esta fase **no** carga el Presentation Engine: composición y motor siguen desacoplados. La función queda cubierta por tests y disponible para Fase 5.

## 9. Archivos

Crear:
- `src/domain/projects/rundown.ts` — tipos `RundownItem`, `RundownItemType`.
- `src/domain/projects/rundown-rules.ts` — add, remove, move, normalización de `order`, recuento de uso de una Song.
- `src/domain/presentation/project-to-presentation.ts` — `projectToPresentation`.
- `src/features/projects/components/rundown-list.tsx`, `rundown-row.tsx`, `song-picker-panel.tsx`.
- `tests/domain/rundown-rules.test.ts`
- `tests/domain/project-to-presentation.test.ts`
- `tests/services/project-repository-migration.test.ts`

Modificar:
- `src/domain/projects/project.ts` — `rundown: RundownItem[]`, sin `itemIds`.
- `src/domain/projects/project-rules.ts` — crear/duplicar con rundown (duplicar genera **nuevos `RundownItem.id`** conservando `sourceId`).
- `src/services/projects/local-storage-project-repository.ts` — clave v2, migración desde v1, validación por item.
- `src/features/projects/project-service.ts` y `projects-context.tsx` — operaciones de rundown.
- `src/routes/_app.projects.$projectId.tsx` — pantalla de preparación; envolver la rama Projects con `SongsProvider` para acceder a la biblioteca.
- `src/features/songs/components/song-actions.tsx` — aviso de uso antes de eliminar.
- `tests/services/local-storage-project-repository.test.ts`, `tests/domain/project-rules.test.ts` — actualizados al nuevo modelo.
- `docs/ROADMAP.md` (nueva Fase 4.5 entre 4 y 5), `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`.

No se modifican `package.json` ni `bun.lock`.

## 10. Tests (`bun test`)

Rundown: agregar, agregar la misma Song dos veces (mismo `sourceId`, ids distintos), mover arriba/abajo incluidos los extremos, eliminar una instancia sin afectar la otra, `order` siempre 0..n-1, recuento de uso por Song.

Migración: v1 sin `rundown` → `rundown: []` conservando id/nombre/fechas y `activeProjectId`; `itemIds` descartado; v1 preservada tras migrar; v2 leída sin volver a migrar; `rundown` no-array → `[]`; item inválido descartado conservando los válidos; JSON corrupto → estado vacío; persistencia de un rundown completo tras recarga.

Conversión: orden correcto, `itemId = RundownItem.id`, `sourceId = song.id`, misma Song dos veces sin colisión de ids de slide, referencia rota como item sin slides, project vacío → `[]`.

Duplicar project: rundown copiado con ids de instancia nuevos y mismos `sourceId`.

## 11. ADR propuestas

- **ADR-018 — Rundown embebido en Project**: justificación frente a colección separada; `itemIds` eliminado.
- **ADR-019 — Migración versionada de la clave de Projects**: v1 → v2 sin destruir datos, respaldo conservado, validación por item no destructiva a nivel de lista.
- **ADR-020 — Referencias rotas conservadas**: nunca se borran en cascada; se muestran como contenido faltante y se convierten en items sin slides.
- **ADR-021 — Eliminar Song usada: advertir, no bloquear**.

## 12. Fuera de alcance

Live UI, Preview, Program, outputs, Clear/Black/Logo, BroadcastChannel, Remote, Bible, Media, presentaciones manuales, Presets, PWA, IndexedDB, Supabase, Sync, drag & drop, transiciones, video.

## 13. Riesgos y decisiones que requieren tu aprobación

1. **Eliminar `itemIds`** del modelo en lugar de mantenerlo vacío. Simplifica, pero es un cambio de modelo persistido (cubierto por la migración).
2. **Subida a la clave v2** conservando v1 como respaldo sin borrarla: ocupa espacio duplicado en localStorage hasta que una fase posterior la limpie.
3. **Advertir sin bloquear** al eliminar una Song en uso: aparecerán referencias rotas si el usuario confirma.
4. **Sin drag & drop** en esta fase; solo subir/bajar.
5. **Panel lateral persistente** para agregar canciones, en lugar de dialog o command palette.
6. **La UI no carga el Presentation Engine**: la conversión existe y está testeada, pero no será observable en pantalla hasta Fase 5.
