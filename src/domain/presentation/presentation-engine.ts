import type { PresentationItem, PresentationState } from "./presentation";
import { EMPTY_PRESENTATION_RUNTIME, buildPresentationRuntime } from "./presentation-runtime";

/**
 * Comandos del Presentation Engine.
 *
 * Todos son funciones puras `(state, ...) => state`. Cuando un comando no
 * cambia nada devuelven la MISMA referencia de estado, de modo que los
 * suscriptores puedan evitar trabajo innecesario.
 */

export function createInitialPresentationState(): PresentationState {
  return {
    runtime: EMPTY_PRESENTATION_RUNTIME,
    currentItemId: null,
    currentSlideId: null,
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
  if (state.currentItemId === itemId && state.currentSlideId === slideId) return state;
  return { ...state, currentItemId: itemId, currentSlideId: slideId };
}

function atSlide(state: PresentationState, slideId: string): PresentationState {
  const itemId = itemIdOfSlide(state, slideId);
  if (!itemId) return state;
  return positioned(state, itemId, slideId);
}

/**
 * Carga o reemplaza la presentación, preservando la posición cuando es posible:
 * misma slide → mismo item → primera slide navegable → vacío.
 */
export function load(state: PresentationState, items: PresentationItem[]): PresentationState {
  const runtime = buildPresentationRuntime(items);
  const next: PresentationState = { runtime, currentItemId: null, currentSlideId: null };

  if (state.currentSlideId && runtime.slideLocationById.has(state.currentSlideId)) {
    return atSlide(next, state.currentSlideId);
  }

  if (state.currentItemId && runtime.itemIndexById.has(state.currentItemId)) {
    return selectItem(next, state.currentItemId);
  }

  const first = firstNavigableSlideId(next);
  return first ? atSlide(next, first) : next;
}

export function reset(): PresentationState {
  return createInitialPresentationState();
}

/**
 * Selecciona un item. Si el item no tiene slides, queda seleccionado con
 * `currentSlideId = null` (invariante 1 y 2 del modelo).
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
 * Índice navegable de referencia cuando no hay slide actual pero sí un item
 * seleccionado (item vacío): devuelve el rango [antes, después] del item.
 */
function navigableBoundsOfEmptySelection(state: PresentationState): {
  before: number;
  after: number;
} | null {
  if (!state.currentItemId) return null;
  const itemIndex = state.runtime.itemIndexById.get(state.currentItemId);
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

  if (state.currentSlideId) {
    const location = state.runtime.slideLocationById.get(state.currentSlideId);
    if (!location) return state;
    const targetId = ids[location.navigableIndex + direction];
    return targetId ? atSlide(state, targetId) : state;
  }

  // Sin slide actual: desde un item vacío buscamos la slide navegable más
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

/** Avanza; atraviesa items y es no-op en la última slide navegable (sin wrap). */
export function next(state: PresentationState): PresentationState {
  return step(state, 1);
}

/** Retrocede; atraviesa items y es no-op en la primera slide navegable. */
export function previous(state: PresentationState): PresentationState {
  return step(state, -1);
}
