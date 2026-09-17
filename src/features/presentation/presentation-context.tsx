import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { PresentationState } from "@/domain/presentation/presentation";
import { createInitialPresentationState } from "@/domain/presentation/presentation-engine";
import { createPresentationStore, type PresentationStore } from "@/stores/presentation-store";

const PresentationContext = createContext<PresentationStore | null>(null);

/** Snapshot determinista para SSR: el motor arranca vacío en el servidor. */
const SERVER_SNAPSHOT: PresentationState = createInitialPresentationState();

export function PresentationProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: PresentationStore;
}) {
  const value = useMemo(() => store ?? createPresentationStore(), [store]);
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentationStore(): PresentationStore {
  const store = useContext(PresentationContext);
  if (!store) throw new Error("usePresentationStore debe usarse dentro de PresentationProvider.");
  return store;
}

export function usePresentationState(): PresentationState {
  const store = usePresentationStore();
  return useSyncExternalStore(store.subscribe, store.getState, () => SERVER_SNAPSHOT);
}
