import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import type {
  BibleBookMeta,
  BibleChapter,
  BibleVersionMeta,
  CanonicalBible,
} from "@/domain/bible/bible";
import { BibleService } from "@/features/bible/bible-service";
import { createIndexedDbBibleRepository } from "@/services/bible/indexeddb-bible-repository";

interface BibleState {
  versions: BibleVersionMeta[];
  /** Hay una operación de carga en curso. */
  loading: boolean;
  /** La carga inicial ya terminó al menos una vez (con éxito o con error). */
  hasLoaded: boolean;
  error: string | null;
}

interface BibleContextValue extends BibleState {
  /** Convierte el archivo al modelo canónico, sin instalar nada. */
  parseFile(text: string): CanonicalBible;
  installBible(bible: CanonicalBible): Promise<BibleVersionMeta>;
  removeBible(versionId: string): Promise<void>;
  getBooks(versionId: string): Promise<BibleBookMeta[]>;
  getChapter(versionId: string, bookUsfm: string, chapter: string): Promise<BibleChapter | null>;
  /** Revalida SOLO la metadata de traducciones instaladas; nunca el texto. */
  refreshVersions(): Promise<void>;
  clearError(): void;
}

type Action =
  | { type: "loaded"; versions: BibleVersionMeta[] }
  | { type: "failed"; message: string }
  | { type: "clearError" };

const initialState: BibleState = { versions: [], loading: true, hasLoaded: false, error: null };
const BibleContext = createContext<BibleContextValue | null>(null);

function reducer(state: BibleState, action: Action): BibleState {
  if (action.type === "loaded") {
    return { versions: action.versions, loading: false, hasLoaded: true, error: null };
  }
  if (action.type === "failed") {
    return { ...state, loading: false, hasLoaded: true, error: action.message };
  }
  return { ...state, error: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación en el almacenamiento local.";
}

export function BibleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // IndexedDB solo existe en el navegador: en SSR el servicio es null y la
  // pantalla queda en estado de carga hasta la hidratación.
  const service = useMemo(() => {
    if (typeof window === "undefined" || !window.indexedDB) return null;
    return new BibleService(createIndexedDbBibleRepository(window.indexedDB), {
      createId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!service) return;
    try {
      dispatch({ type: "loaded", versions: await service.load() });
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requireService = useCallback((): BibleService => {
    if (!service) throw new Error("El almacenamiento local no está disponible.");
    return service;
  }, [service]);

  const value = useMemo<BibleContextValue>(
    () => ({
      ...state,
      parseFile: (text) => requireService().parse(text),
      installBible: async (bible) => {
        try {
          const meta = await requireService().install(bible);
          await refresh();
          return meta;
        } catch (error) {
          dispatch({ type: "failed", message: errorMessage(error) });
          throw error;
        }
      },
      removeBible: async (versionId) => {
        try {
          await requireService().remove(versionId);
          await refresh();
        } catch (error) {
          dispatch({ type: "failed", message: errorMessage(error) });
          throw error;
        }
      },
      refreshVersions: refresh,
      getBooks: (versionId) => requireService().getBooks(versionId),
      getChapter: (versionId, bookUsfm, chapter) =>
        requireService().getChapter(versionId, bookUsfm, chapter),
      clearError: () => dispatch({ type: "clearError" }),
    }),
    [refresh, requireService, state],
  );

  return <BibleContext.Provider value={value}>{children}</BibleContext.Provider>;
}

export function useBible(): BibleContextValue {
  const context = useContext(BibleContext);
  if (!context) throw new Error("useBible debe utilizarse dentro de BibleProvider.");
  return context;
}
