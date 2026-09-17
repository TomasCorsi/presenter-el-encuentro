import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

import type { Song, SongSectionType } from "@/domain/songs/song";
import type { UpdateSectionInput } from "@/domain/songs/song-rules";
import { SongService } from "@/features/songs/song-service";
import { createLocalStorageSongRepository } from "@/services/songs/local-storage-song-repository";

interface SongsState {
  songs: Song[];
  loading: boolean;
  error: string | null;
}

interface SongsContextValue extends SongsState {
  createSong(title: string, author?: string): Promise<Song>;
  renameSong(id: string, title: string): Promise<Song>;
  updateAuthor(id: string, author: string | undefined): Promise<Song>;
  duplicateSong(id: string): Promise<Song>;
  deleteSong(id: string): Promise<void>;
  saveSong(draft: Song): Promise<Song>;
  addSection(id: string, type: SongSectionType): Promise<Song>;
  updateSection(id: string, sectionId: string, input: UpdateSectionInput): Promise<Song>;
  removeSection(id: string, sectionId: string): Promise<Song>;
  moveSection(id: string, sectionId: string, direction: "up" | "down"): Promise<Song>;
  clearError(): void;
}

type Action =
  | { type: "loaded"; songs: Song[] }
  | { type: "failed"; message: string }
  | { type: "clearError" };

const initialState: SongsState = { songs: [], loading: true, error: null };
const SongsContext = createContext<SongsContextValue | null>(null);

function reducer(state: SongsState, action: Action): SongsState {
  if (action.type === "loaded") return { songs: action.songs, loading: false, error: null };
  if (action.type === "failed") return { ...state, loading: false, error: action.message };
  return { ...state, error: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar el cambio localmente.";
}

export function SongsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = useMemo(() => {
    if (typeof window === "undefined") return null;
    const repository = createLocalStorageSongRepository(window.localStorage);
    return new SongService(repository, {
      createId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!service) return;
    try {
      dispatch({ type: "loaded", songs: await service.load() });
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async <T,>(operation: (service: SongService) => Promise<T>): Promise<T> => {
    if (!service) throw new Error("El almacenamiento local no está disponible.");
    try {
      const result = await operation(service);
      await refresh();
      return result;
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
      throw error;
    }
  }, [refresh, service]);

  const value = useMemo<SongsContextValue>(() => ({
    ...state,
    createSong: (title, author) => run((service) => service.create({ title, author })),
    renameSong: (id, title) => run((service) => service.rename(id, title)),
    updateAuthor: (id, author) => run((service) => service.updateAuthor(id, author)),
    duplicateSong: (id) => run((service) => service.duplicate(id)),
    deleteSong: async (id) => { await run((service) => service.delete(id)); },
    saveSong: (draft) => run((service) => service.save(draft)),
    addSection: (id, type) => run((service) => service.addSection(id, type)),
    updateSection: (id, sectionId, input) => run((service) => service.updateSection(id, sectionId, input)),
    removeSection: (id, sectionId) => run((service) => service.removeSection(id, sectionId)),
    moveSection: (id, sectionId, direction) => run((service) => service.moveSection(id, sectionId, direction)),
    clearError: () => dispatch({ type: "clearError" }),
  }), [run, state]);

  return <SongsContext.Provider value={value}>{children}</SongsContext.Provider>;
}

export function useSongs(): SongsContextValue {
  const context = useContext(SongsContext);
  if (!context) throw new Error("useSongs debe utilizarse dentro de SongsProvider.");
  return context;
}
