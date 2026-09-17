import type {
  PresentationItem,
  PresentationState,
  ProgramMode,
  Slide,
} from "./presentation";

/**
 * Selectores derivados. Nada aquí se almacena en el estado: todo se resuelve
 * en O(1) a partir del runtime, de la posición de Preview y de
 * `programSlideId` (ADR-022, cierre de ADR-017).
 */

function itemById(state: PresentationState, itemId: string | null): PresentationItem | null {
  if (!itemId) return null;
  const index = state.runtime.itemIndexById.get(itemId);
  if (index === undefined) return null;
  return state.runtime.items[index] ?? null;
}

function slideById(state: PresentationState, slideId: string | null): Slide | null {
  if (!slideId) return null;
  const location = state.runtime.slideLocationById.get(slideId);
  if (!location) return null;
  return state.runtime.items[location.itemIndex]?.slides[location.slideIndex] ?? null;
}

export function getPreviewItem(state: PresentationState): PresentationItem | null {
  return itemById(state, state.previewItemId);
}

export function getPreviewSlide(state: PresentationState): Slide | null {
  return slideById(state, state.previewSlideId);
}

/** El item de Program se DERIVA del runtime: nunca se almacena. */
export function getProgramItem(state: PresentationState): PresentationItem | null {
  if (!state.programSlideId) return null;
  const location = state.runtime.slideLocationById.get(state.programSlideId);
  if (!location) return null;
  return state.runtime.items[location.itemIndex] ?? null;
}

export function getProgramSlide(state: PresentationState): Slide | null {
  return slideById(state, state.programSlideId);
}

export interface ProgramOutput {
  mode: ProgramMode;
  /** `null` en `clear` y `black`, aunque Program recuerde su slide. */
  slide: Slide | null;
}

export function getProgramOutput(state: PresentationState): ProgramOutput {
  return {
    mode: state.programMode,
    slide: state.programMode === "content" ? getProgramSlide(state) : null,
  };
}

export function isSlideInProgram(state: PresentationState, slideId: string): boolean {
  return state.programSlideId === slideId;
}

export function isItemInProgram(state: PresentationState, itemId: string): boolean {
  return getProgramItem(state)?.id === itemId;
}

export function getPreviewItemIndex(state: PresentationState): number {
  if (!state.previewItemId) return -1;
  return state.runtime.itemIndexById.get(state.previewItemId) ?? -1;
}

export function getPreviewSlideIndex(state: PresentationState): number {
  if (!state.previewSlideId) return -1;
  return state.runtime.slideLocationById.get(state.previewSlideId)?.slideIndex ?? -1;
}

function slideAtNavigableOffset(state: PresentationState, offset: number): Slide | null {
  if (!state.previewSlideId) return null;
  const location = state.runtime.slideLocationById.get(state.previewSlideId);
  if (!location) return null;

  const id = state.runtime.navigableSlideIds[location.navigableIndex + offset];
  if (!id) return null;
  return slideById(state, id);
}

/** Siguiente y anterior slide referidas a Preview. */
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
