import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { DEFAULT_PRESET, type Preset, type PresetStyle } from "@/domain/presets/preset";
import { PresetService } from "@/features/presets/preset-service";
import { createLocalStoragePresetRepository } from "@/services/presets/local-storage-preset-repository";

interface PresetsState {
  presets: Preset[];
  /** Hay una operación de carga en curso. */
  loading: boolean;
  /** La carga inicial ya terminó al menos una vez (con éxito o con error). */
  hasLoaded: boolean;
  error: string | null;
}

interface PresetsContextValue extends PresetsState {
  createPreset(name: string, style?: PresetStyle): Promise<Preset>;
  renamePreset(id: string, name: string): Promise<Preset>;
  savePreset(draft: Preset): Promise<Preset>;
  duplicatePreset(id: string): Promise<Preset>;
  deletePreset(id: string): Promise<void>;
  clearError(): void;
}

type Action =
  | { type: "loaded"; presets: Preset[] }
  | { type: "failed"; message: string }
  | { type: "clearError" };

// El Default está presente incluso antes de la primera lectura: la UI nunca ve
// una biblioteca sin estilo válido.
const initialState: PresetsState = {
  presets: [DEFAULT_PRESET],
  loading: true,
  hasLoaded: false,
  error: null,
};

const PresetsContext = createContext<PresetsContextValue | null>(null);

function reducer(state: PresetsState, action: Action): PresetsState {
  if (action.type === "loaded") {
    return { presets: action.presets, loading: false, hasLoaded: true, error: null };
  }
  if (action.type === "failed") {
    return { ...state, loading: false, hasLoaded: true, error: action.message };
  }
  return { ...state, error: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar el cambio localmente.";
}

export function PresetsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = useMemo(() => {
    if (typeof window === "undefined") return null;
    const repository = createLocalStoragePresetRepository(window.localStorage);
    return new PresetService(repository, {
      createId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!service) return;
    try {
      dispatch({ type: "loaded", presets: await service.load() });
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async <T,>(operation: (service: PresetService) => Promise<T>): Promise<T> => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      try {
        const result = await operation(service);
        await refresh();
        return result;
      } catch (error) {
        dispatch({ type: "failed", message: errorMessage(error) });
        throw error;
      }
    },
    [refresh, service],
  );

  const value = useMemo<PresetsContextValue>(
    () => ({
      ...state,
      createPreset: (name, style) => run((s) => s.create({ name, style })),
      renamePreset: (id, name) => run((s) => s.rename(id, name)),
      savePreset: (draft) => run((s) => s.save(draft)),
      duplicatePreset: (id) => run((s) => s.duplicate(id)),
      deletePreset: async (id) => {
        await run((s) => s.delete(id));
      },
      clearError: () => dispatch({ type: "clearError" }),
    }),
    [run, state],
  );

  return <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>;
}

export function usePresets(): PresetsContextValue {
  const context = useContext(PresetsContext);
  if (!context) throw new Error("usePresets debe utilizarse dentro de PresetsProvider.");
  return context;
}
