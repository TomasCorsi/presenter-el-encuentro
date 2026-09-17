import type { PresentationState } from "./presentation";
import { next, previous, selectSlide } from "./presentation-engine";
import { take } from "./presentation-program";

/**
 * Comandos OPERATIVOS de Live, por encima del engine base.
 *
 * `next()` / `previous()` del engine siguen siendo navegación pura de Preview.
 * Aquí se añade la regla de operación musical (ADR-037, extensión de ADR-025):
 *
 *   Si Preview y Program están en el MISMO item y el salto no cruza el borde
 *   de ese item, Program avanza junto con Preview (sin TAKE).
 *   Cruzar de item mueve solo Preview: cambiar de item exige TAKE.
 *
 * `programMode` NUNCA se modifica aquí: en `clear` / `black` el contenido de
 * Program avanza internamente y la salida sigue vacía o negra (ADR-024).
 */

function itemIdOfSlide(state: PresentationState, slideId: string): string | null {
  const location = state.runtime.slideLocationById.get(slideId);
  if (!location) return null;
  return state.runtime.items[location.itemIndex]?.id ?? null;
}

function advance(
  state: PresentationState,
  move: (state: PresentationState) => PresentationState,
): PresentationState {
  const moved = move(state);
  // No-op en los límites: misma referencia, el store no notifica.
  if (moved === state) return state;

  // Sin Program no hay nada que arrastrar.
  if (!state.programSlideId) return moved;

  const programItemId = itemIdOfSlide(state, state.programSlideId);
  if (!programItemId) return moved; // referencia rota

  // Preview ya estaba en otro item: nunca se salta Program a otro item.
  if (state.previewItemId !== programItemId) return moved;

  // El salto cruzó el borde del item al aire: Program se queda donde estaba.
  if (moved.previewItemId !== programItemId) return moved;

  if (!moved.previewSlideId) return moved;
  if (moved.programSlideId === moved.previewSlideId) return moved;

  return { ...moved, programSlideId: moved.previewSlideId };
}

/** Siguiente slide; arrastra Program dentro del item al aire. */
export function nextLive(state: PresentationState): PresentationState {
  return advance(state, next);
}

/** Slide anterior; arrastra Program dentro del item al aire. */
export function previousLive(state: PresentationState): PresentationState {
  return advance(state, previous);
}

/**
 * Operación explícita de la rejilla de slides: LA SLIDE VA AL AIRE (ADR-043).
 *
 * Es la misma transición de TAKE (Preview → Program → `content`), precedida de
 * la selección, para no duplicar lógica. Fuerza `content`: si la salida estaba
 * en Clear o Black, el clic la devuelve al contenido y muestra la slide.
 * No-op cuando el id no existe en el runtime.
 */
export function goLive(state: PresentationState, slideId: string): PresentationState {
  const selected = selectSlide(state, slideId);
  if (selected.previewSlideId !== slideId) return state;
  return take(selected);
}
