import type { PresentationState, ProgramMode } from "./presentation";

/**
 * Comandos de Program. Puros, igual que el resto del motor.
 *
 * Program guarda un único id (`programSlideId`); su item se deriva del
 * runtime. `clear` y `black` son modos temporales de salida y NUNCA borran
 * `programSlideId`: volver a `content` devuelve al aire la misma slide.
 */

/**
 * Envía a Program la slide de Preview y fuerza el modo `content`.
 * No-op cuando Preview no tiene slide (item vacío o referencia rota).
 * Nunca mueve Preview.
 */
export function take(state: PresentationState): PresentationState {
  if (!state.previewSlideId) return state;
  if (
    state.programSlideId === state.previewSlideId &&
    state.programMode === "content" &&
    state.detachedProgramSlide === null
  ) {
    return state;
  }
  // Un contenido nuevo al aire descarta siempre la salida congelada de un
  // item eliminado y vuelve a `content`, venga de Clear o de Black (ADR-045).
  return {
    ...state,
    programSlideId: state.previewSlideId,
    programMode: "content",
    detachedProgramSlide: null,
  };
}

/** Cambia el modo de salida sin tocar el contenido de Program. */
export function setProgramMode(state: PresentationState, mode: ProgramMode): PresentationState {
  if (state.programMode === mode) return state;
  return { ...state, programMode: mode };
}

/** Alterna entre un modo de salida y `content` (botones Clear / Black). */
export function toggleProgramMode(
  state: PresentationState,
  mode: Exclude<ProgramMode, "content">,
): PresentationState {
  return setProgramMode(state, state.programMode === mode ? "content" : mode);
}

/** Mensaje único cuando se intenta quitar un Media que está al aire. */
export const MEDIA_ON_AIR_REMOVAL_MESSAGE = "Cambia primero el contenido que está al aire.";

/**
 * Motivo compartido por dominio y UIs para impedir una baja insegura.
 * `null` significa que el item puede quitarse.
 */
export function mediaRemovalBlockReason(state: PresentationState, itemId: string): string | null {
  return isMediaRemovalBlocked(state, itemId) ? MEDIA_ON_AIR_REMOVAL_MESSAGE : null;
}

/**
 * Regla de Fase 10: un item Media (image/video) en Program NO puede quitarse
 * del rundown, en ningún modo (content/clear/black). Media no usa
 * `detachedProgramSlide`: así Output nunca queda apuntando a un media que ya
 * no pertenece al show. Songs/Bible siguen con ADR-045.
 */
export function isMediaRemovalBlocked(state: PresentationState, itemId: string): boolean {
  if (!state.programSlideId) return false;
  const location = state.runtime.slideLocationById.get(state.programSlideId);
  if (!location) return false;
  const programItem = state.runtime.items[location.itemIndex];
  return programItem?.id === itemId && programItem.type === "media";
}
