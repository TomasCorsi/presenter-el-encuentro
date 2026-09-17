import type { PresentationItem, PresentationState } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  goToFirst,
  goToLast,
  load,
  next,
  previous,
  reset,
  selectItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";

type Listener = () => void;

export interface PresentationStore {
  getState(): PresentationState;
  subscribe(listener: Listener): () => void;
  load(items: PresentationItem[]): void;
  reset(): void;
  selectItem(itemId: string): void;
  selectSlide(slideId: string): void;
  next(): void;
  previous(): void;
  goToFirst(): void;
  goToLast(): void;
}

/**
 * Store vanilla, sin dependencias y sin React.
 *
 * Alcance: suscripciones dentro de UN mismo runtime JS. NO sincroniza ventanas
 * distintas; ese mecanismo llega en su fase correspondiente.
 */
export function createPresentationStore(
  initialState: PresentationState = createInitialPresentationState(),
): PresentationStore {
  let state = initialState;
  const listeners = new Set<Listener>();

  function apply(nextState: PresentationState): void {
    // Los comandos devuelven la misma referencia cuando no cambian nada:
    // no se notifica para evitar renders inútiles.
    if (nextState === state) return;
    state = nextState;
    for (const listener of listeners) listener();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: (items) => apply(load(state, items)),
    reset: () => apply(reset()),
    selectItem: (itemId) => apply(selectItem(state, itemId)),
    selectSlide: (slideId) => apply(selectSlide(state, slideId)),
    next: () => apply(next(state)),
    previous: () => apply(previous(state)),
    goToFirst: () => apply(goToFirst(state)),
    goToLast: () => apply(goToLast(state)),
  };
}
