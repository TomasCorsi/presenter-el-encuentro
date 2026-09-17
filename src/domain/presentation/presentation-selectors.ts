import type { PresentationItem, PresentationState, Slide } from "./presentation";

/**
 * Selectores derivados. Nada aquí se almacena en el estado: todo se resuelve
 * en O(1) a partir del runtime y de `currentItemId` / `currentSlideId`.
 *
 * Nomenclatura neutral a propósito (ADR-017): mientras Preview y Program no
 * existan como estados separados, la posición actual no representa Program.
 */

export function getCurrentItem(state: PresentationState): PresentationItem | null {
  if (!state.currentItemId) return null;
  const index = state.runtime.itemIndexById.get(state.currentItemId);
  if (index === undefined) return null;
  return state.runtime.items[index] ?? null;
}

export function getCurrentSlide(state: PresentationState): Slide | null {
  if (!state.currentSlideId) return null;
  const location = state.runtime.slideLocationById.get(state.currentSlideId);
  if (!location) return null;
  return state.runtime.items[location.itemIndex]?.slides[location.slideIndex] ?? null;
}

export function getCurrentItemIndex(state: PresentationState): number {
  if (!state.currentItemId) return -1;
  return state.runtime.itemIndexById.get(state.currentItemId) ?? -1;
}

export function getCurrentSlideIndex(state: PresentationState): number {
  if (!state.currentSlideId) return -1;
  return state.runtime.slideLocationById.get(state.currentSlideId)?.slideIndex ?? -1;
}

function slideAtNavigableOffset(state: PresentationState, offset: number): Slide | null {
  if (!state.currentSlideId) return null;
  const location = state.runtime.slideLocationById.get(state.currentSlideId);
  if (!location) return null;

  const id = state.runtime.navigableSlideIds[location.navigableIndex + offset];
  if (!id) return null;

  const target = state.runtime.slideLocationById.get(id);
  if (!target) return null;
  return state.runtime.items[target.itemIndex]?.slides[target.slideIndex] ?? null;
}

export function getNextSlide(state: PresentationState): Slide | null {
  return slideAtNavigableOffset(state, 1);
}

export function getPreviousSlide(state: PresentationState): Slide | null {
  return slideAtNavigableOffset(state, -1);
}

export function getItems(state: PresentationState): readonly PresentationItem[] {
  return state.runtime.items;
}

export function isEmpty(state: PresentationState): boolean {
  return state.runtime.items.length === 0;
}
