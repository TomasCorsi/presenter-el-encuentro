# Fase 8.1 — Auto-advance de Program dentro del item al aire

Next / Previous siguen moviendo Preview, pero cuando Preview y Program están en el MISMO item y el salto no cruza el borde de ese item, Program avanza con Preview. Cruzar de item sigue exigiendo TAKE.

## 1. Dónde vive la lógica

En dominio, no en React ni en la ruta. Se crean comandos operativos de Live por encima del engine base:

- `src/domain/presentation/presentation-live.ts` (nuevo)
  - `nextLive(state): PresentationState`
  - `previousLive(state): PresentationState`

`next()` / `previous()` del engine no cambian: siguen siendo navegación pura de Preview y los usan `nextLive`/`previousLive` internamente. Así los tests existentes de engine quedan intactos y la nueva regla es testeable por separado.

```ts
function advance(state, move) {
  const moved = move(state);                    // next() o previous()
  if (moved === state) return state;            // no-op (límites) → nada
  if (!state.programSlideId) return moved;      // no hay Program
  const programItemId = itemIdOfSlide(state, state.programSlideId);
  if (!programItemId) return moved;             // referencia rota
  if (state.previewItemId !== programItemId) return moved;   // Preview ya en otro item
  if (moved.previewItemId !== programItemId) return moved;   // el salto cruzó el item
  if (!moved.previewSlideId) return moved;      // sin slide destino
  return { ...moved, programSlideId: moved.previewSlideId }; // programMode intacto
}
```

## 2. Cómo se detecta "mismo item"

Con `runtime.slideLocationById` (igual que `getProgramItem`): el item de Program se deriva de `programSlideId`, nunca se almacena. Se comparan tres cosas: item de Program, `previewItemId` ANTES del salto y `previewItemId` DESPUÉS del salto. Los tres deben coincidir.

## 3. Cruce de límites

Si la slide destino pertenece a otro item, Preview se mueve normalmente y `programSlideId` / `programMode` quedan exactamente como estaban. Igual en la primera/última slide global: `next()`/`previous()` ya son no-op sin wrap, y el comando devuelve la misma referencia (sin notificar al store).

Item vacío o referencia rota: como `previewSlideId` es `null` o el item no coincide, nunca se auto-envía nada.

## 4. Clear / Black

`programMode` NO se toca en el auto-advance. Con `clear` o `black`, `programSlideId` avanza internamente y la salida sigue vacía/negra; al volver a `content` aparece la slide correcta. Solo TAKE fuerza `content`. Esto es coherente con ADR-024 (el modo es estado de salida, ortogonal al contenido).

Consecuencia visible: en clear/black el monitor Program sigue mostrando su badge de modo, y la marca "en program" de la rejilla de slides se mueve — señal útil de dónde quedará el contenido al volver.

## 5. Store y UI

- `src/stores/presentation-store.ts`: `next()` y `previous()` pasan a delegar en `nextLive`/`previousLive`. No se añaden métodos nuevos; Live ya llama `store.next()` / `store.previous()`, y el teclado (`ArrowRight`/`ArrowLeft`) hereda la nueva semántica sin tocar `use-live-keyboard.ts`.
- `src/features/live/components/live-controls.tsx`: solo textos de tooltip — "Avanza al aire dentro del item actual" en Previous/Next, "Envía la slide seleccionada a Program" en TAKE. Sin toggle ni configuración.

Si prefieres que el store exponga `nextLive`/`previousLive` como métodos separados y deje `next`/`previous` puros, se hace así; entonces la ruta Live cambia sus dos callbacks. Dime tu preferencia (por defecto tomo la opción de arriba: el store de Live es operativo).

## 6. Tests

Nuevo `tests/domain/presentation-live.test.ts`:

1. Program A/1 + Next → Preview y Program en A/2.
2. Program A/2 + Previous → ambos en A/1.
3. Auto-advance dentro del item conserva `programMode = "content"`.
4. Igual con `clear`: `programSlideId` avanza, modo sigue `clear`.
5. Igual con `black`.
6. Next desde la última slide de A → Preview a B/1, Program sigue en A/última.
7. Previous desde la primera de B → Preview a A/última, Program sigue en B.
8. Preview en item distinto de Program → Next no toca Program.
9. Sin Program / item vacío / referencia rota → nunca se auto-envía.
10. TAKE conserva su semántica (fuerza `content`).
11. No-op en límites globales devuelve la MISMA referencia de estado.

Se amplía `tests/stores/presentation-store.test.ts` con un caso de auto-advance vía store.

## 7. Archivos

Crear: `src/domain/presentation/presentation-live.ts`, `tests/domain/presentation-live.test.ts`.

Modificar: `src/stores/presentation-store.ts`, `src/features/live/components/live-controls.tsx` (tooltips), `tests/stores/presentation-store.test.ts`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (ADR-037 extendiendo ADR-025), `docs/TESTING.md`.

Sin dependencias nuevas. Sin cambios en Presets, Output protocol ni Presentation Engine base.

## 8. Riesgos de regresión

- **Bajo, acotado**: el engine no cambia; solo el store enruta a los comandos operativos. Los tests actuales de `next`/`previous` siguen midiendo el comportamiento puro.
- **Output**: cada auto-advance publica un update (como un TAKE). En `clear`/`black` el snapshot publicado no cambia (slide nula en esos modos), así que no hay tráfico ni parpadeo extra.
- **Cambio de hábito del operador**: con la canción al aire, Next ya manda contenido inmediatamente. Es lo pedido, pero es el único riesgo real de error humano; mitigado porque nunca cruza de item.
