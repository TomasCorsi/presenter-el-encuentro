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
  if (state.programSlideId === state.previewSlideId && state.programMode === "content") {
    return state;
  }
  return { ...state, programSlideId: state.previewSlideId, programMode: "content" };
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
