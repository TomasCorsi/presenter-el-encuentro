import type { PresentationItem, PresentationState } from "./presentation";
import { EMPTY_PRESENTATION_RUNTIME, buildPresentationRuntime } from "./presentation-runtime";

/**
 * Comandos del Presentation Engine.
 *
 * Todos son funciones puras `(state, ...) => state`. Cuando un comando no
 * cambia nada devuelven la MISMA referencia de estado, de modo que los
 * suscriptores puedan evitar trabajo innecesario.
 *
 * Todos los comandos de navegación operan sobre PREVIEW. Program solo cambia
 * mediante los comandos de `presentation-program.ts` (ADR-022, ADR-025).
 */

export function createInitialPresentationState(): PresentationState {
  return {
    runtime: EMPTY_PRESENTATION_RUNTIME,
    previewItemId: null,
    previewSlideId: null,
    programSlideId: null,
    programMode: "content",
  };
}

function firstNavigableSlideId(state: PresentationState): string | null {
  return state.runtime.navigableSlideIds[0] ?? null;
}

function itemIdOfSlide(state: PresentationState, slideId: string): string | null {
  const location = state.runtime.slideLocationById.get(slideId);
  if (!location) return null;
  return state.runtime.items[location.itemIndex]?.id ?? null;
}

function positioned(
  state: PresentationState,
  itemId: string | null,
  slideId: string | null,
): PresentationState {
  if (state.previewItemId === itemId && state.previewSlideId === slideId) return state;
  return { ...state, previewItemId: itemId, previewSlideId: slideId };
}

function atSlide(state: PresentationState, slideId: string): PresentationState {
  const itemId = itemIdOfSlide(state, slideId);
  if (!itemId) return state;
  return positioned(state, itemId, slideId);
}

/**
 * Posiciona Preview en un estado recién construido siguiendo la estrategia de
 * preservación: misma slide → mismo item → primera slide navegable → vacío.
 */
function restorePreview(base: PresentationState, previous: PresentationState): PresentationState {
  if (previous.previewSlideId && base.runtime.slideLocationById.has(previous.previewSlideId)) {
    return atSlide(base, previous.previewSlideId);
  }

  if (previous.previewItemId && base.runtime.itemIndexById.has(previous.previewItemId)) {
    return selectItem(base, previous.previewItemId);
  }

  const first = firstNavigableSlideId(base);
  return first ? atSlide(base, first) : base;
}

/**
 * Inicio o cambio de show: reconstruye el runtime y DESCARTA Program siempre.
 * Un show nuevo nunca hereda lo que estaba al aire (ADR-026).
 */
export function loadPresentation(
  state: PresentationState,
  items: PresentationItem[],
): PresentationState {
  const base: PresentationState = {
    runtime: buildPresentationRuntime(items),
    previewItemId: null,
    previewSlideId: null,
    programSlideId: null,
    programMode: "content",
  };

  return restorePreview(base, state);
}

/**
 * Recarga explícita solicitada por el operador: reconstruye el runtime,
 * conserva Preview cuando es posible y conserva Program únicamente si
 * `programSlideId` sigue existiendo. Sin Program, el modo vuelve a `content`.
 */
export function reloadPresentation(
  state: PresentationState,
  items: PresentationItem[],
): PresentationState {
  const runtime = buildPresentationRuntime(items);
  const programSurvives = state.programSlideId !== null
    && runtime.slideLocationById.has(state.programSlideId);

  const base: PresentationState = {
    runtime,
    previewItemId: null,
    previewSlideId: null,
    programSlideId: programSurvives ? state.programSlideId : null,
    programMode: programSurvives ? state.programMode : "content",
  };

  return restorePreview(base, state);
}

export function reset(): PresentationState {
  return createInitialPresentationState();
}

/**
 * Selecciona un item en Preview. Si el item no tiene slides, queda
 * seleccionado con `previewSlideId = null` (invariantes 1 y 2).
 */
export function selectItem(state: PresentationState, itemId: string): PresentationState {
  const itemIndex = state.runtime.itemIndexById.get(itemId);
  if (itemIndex === undefined) return state;

  const item = state.runtime.items[itemIndex];
  const firstSlide = item?.slides[0];
  return positioned(state, itemId, firstSlide ? firstSlide.id : null);
}

export function selectSlide(state: PresentationState, slideId: string): PresentationState {
  if (!state.runtime.slideLocationById.has(slideId)) return state;
  return atSlide(state, slideId);
}

export function goToFirst(state: PresentationState): PresentationState {
  const first = firstNavigableSlideId(state);
  return first ? atSlide(state, first) : state;
}

export function goToLast(state: PresentationState): PresentationState {
  const ids = state.runtime.navigableSlideIds;
  const last = ids[ids.length - 1];
  return last ? atSlide(state, last) : state;
}

/**
 * Índice navegable de referencia cuando no hay slide de Preview pero sí un
 * item seleccionado (item vacío): devuelve el rango [antes, después].
 */
function navigableBoundsOfEmptySelection(state: PresentationState): {
  before: number;
  after: number;
} | null {
  if (!state.previewItemId) return null;
  const itemIndex = state.runtime.itemIndexById.get(state.previewItemId);
  if (itemIndex === undefined) return null;

  let before = -1;
  let after = state.runtime.navigableSlideIds.length;

  for (const [, location] of state.runtime.slideLocationById) {
    if (location.itemIndex < itemIndex) {
      before = Math.max(before, location.navigableIndex);
    } else if (location.itemIndex > itemIndex && location.navigableIndex < after) {
      after = Math.min(after, location.navigableIndex);
    }
  }

  return { before, after };
}

function step(state: PresentationState, direction: 1 | -1): PresentationState {
  const ids = state.runtime.navigableSlideIds;
  if (ids.length === 0) return state;

  if (state.previewSlideId) {
    const location = state.runtime.slideLocationById.get(state.previewSlideId);
    if (!location) return state;
    const targetId = ids[location.navigableIndex + direction];
    return targetId ? atSlide(state, targetId) : state;
  }

  // Sin slide de Preview: desde un item vacío buscamos la slide navegable más
  // cercana en la dirección pedida; si no hay item, empezamos por los extremos.
  const bounds = navigableBoundsOfEmptySelection(state);
  if (!bounds) {
    const targetId = direction === 1 ? ids[0] : ids[ids.length - 1];
    return targetId ? atSlide(state, targetId) : state;
  }

  const targetIndex = direction === 1 ? bounds.after : bounds.before;
  const targetId = ids[targetIndex];
  return targetId ? atSlide(state, targetId) : state;
}

/** Avanza Preview; atraviesa items y es no-op en la última slide (sin wrap). */
export function next(state: PresentationState): PresentationState {
  return step(state, 1);
}

/** Retrocede Preview; atraviesa items y es no-op en la primera slide. */
export function previous(state: PresentationState): PresentationState {
  return step(state, -1);
}
