import type {
  PresentationItem,
  PresentationState,
  ProgramMode,
} from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  goToFirst,
  goToLast,
  loadPresentation,
  next,
  previous,
  reloadPresentation,
  reset,
  selectItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import {
  setProgramMode,
  take,
  toggleProgramMode,
} from "@/domain/presentation/presentation-program";

type Listener = () => void;

export interface PresentationStore {
  getState(): PresentationState;
  subscribe(listener: Listener): () => void;
  /** Inicio o cambio de show: descarta Program. */
  loadPresentation(items: PresentationItem[]): void;
  /** Recarga explícita: conserva Preview y Program cuando siguen existiendo. */
  reloadPresentation(items: PresentationItem[]): void;
  reset(): void;
  selectItem(itemId: string): void;
  selectSlide(slideId: string): void;
  next(): void;
  previous(): void;
  goToFirst(): void;
  goToLast(): void;
  take(): void;
  setProgramMode(mode: ProgramMode): void;
  toggleProgramMode(mode: Exclude<ProgramMode, "content">): void;
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
    loadPresentation: (items) => apply(loadPresentation(state, items)),
    reloadPresentation: (items) => apply(reloadPresentation(state, items)),
    reset: () => apply(reset()),
    selectItem: (itemId) => apply(selectItem(state, itemId)),
    selectSlide: (slideId) => apply(selectSlide(state, slideId)),
    next: () => apply(next(state)),
    previous: () => apply(previous(state)),
    goToFirst: () => apply(goToFirst(state)),
    goToLast: () => apply(goToLast(state)),
    take: () => apply(take(state)),
    setProgramMode: (mode) => apply(setProgramMode(state, mode)),
    toggleProgramMode: (mode) => apply(toggleProgramMode(state, mode)),
  };
}
