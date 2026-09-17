import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

import type { BiblePassage } from "@/domain/bible/bible";
import type { Project } from "@/domain/projects/project";
import { ProjectService } from "@/features/projects/project-service";
import { createLocalStorageProjectRepository } from "@/services/projects/local-storage-project-repository";

interface ProjectsState {
  projects: Project[];
  activeProjectId: string | null;
  /** Hay una operación de carga en curso. */
  loading: boolean;
  /** La carga inicial ya terminó al menos una vez (con éxito o con error). */
  hasLoaded: boolean;
  error: string | null;
}

interface ProjectsContextValue extends ProjectsState {
  activeProject: Project | null;
  createProject(name: string): Promise<Project>;
  renameProject(id: string, name: string): Promise<void>;
  duplicateProject(id: string): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  setActiveProject(id: string | null): Promise<void>;
  /** Devuelve el Project ya guardado: Live necesita el RundownItem nuevo. */
  addSongToProject(projectId: string, song: { id: string; title: string }): Promise<Project>;
  addPassageToProject(projectId: string, passage: BiblePassage): Promise<Project>;
  removeRundownItem(projectId: string, itemId: string): Promise<void>;
  moveRundownItem(projectId: string, itemId: string, direction: "up" | "down"): Promise<void>;
  setRundownItemPreset(projectId: string, itemId: string, presetId: string | undefined): Promise<void>;
  clearError(): void;
}

type Action =
  | { type: "loaded"; projects: Project[]; activeProjectId: string | null }
  | { type: "failed"; message: string }
  | { type: "clearError" };

const initialState: ProjectsState = {
  projects: [],
  activeProjectId: null,
  loading: true,
  hasLoaded: false,
  error: null,
};
const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function reducer(state: ProjectsState, action: Action): ProjectsState {
  if (action.type === "loaded") {
    return {
      projects: action.projects,
      activeProjectId: action.activeProjectId,
      loading: false,
      hasLoaded: true,
      error: null,
    };
  }
  if (action.type === "failed") {
    return { ...state, loading: false, hasLoaded: true, error: action.message };
  }
  return { ...state, error: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar el cambio localmente.";
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = useMemo(() => {
    if (typeof window === "undefined") return null;
    const repository = createLocalStorageProjectRepository(window.localStorage);
    return new ProjectService(repository, {
      createId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!service) return;
    try {
      dispatch({ type: "loaded", ...(await service.load()) });
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      const result = await operation();
      await refresh();
      return result;
    } catch (error) {
      dispatch({ type: "failed", message: errorMessage(error) });
      throw error;
    }
  }, [refresh]);

  const value = useMemo<ProjectsContextValue>(() => ({
    ...state,
    activeProject: state.projects.find((project) => project.id === state.activeProjectId) ?? null,
    createProject: (name) => {
      if (!service) return Promise.reject(new Error("El almacenamiento local no está disponible."));
      return run(() => service.create({ name }));
    },
    renameProject: async (id, name) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.rename(id, name));
    },
    duplicateProject: (id) => {
      if (!service) return Promise.reject(new Error("El almacenamiento local no está disponible."));
      return run(() => service.duplicate(id));
    },
    deleteProject: async (id) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.delete(id));
    },
    setActiveProject: async (id) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.setActiveProject(id));
    },
    addSongToProject: async (projectId, song) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      return run(() => service.addSong(projectId, song));
    },
    addPassageToProject: async (projectId, passage) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      return run(() => service.addPassage(projectId, passage));
    },
    removeRundownItem: async (projectId, itemId) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.removeRundownItem(projectId, itemId));
    },
    moveRundownItem: async (projectId, itemId, direction) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.moveRundownItem(projectId, itemId, direction));
    },
    setRundownItemPreset: async (projectId, itemId, presetId) => {
      if (!service) throw new Error("El almacenamiento local no está disponible.");
      await run(() => service.setRundownItemPreset(projectId, itemId, presetId));
    },
    clearError: () => dispatch({ type: "clearError" }),
  }), [run, service, state]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error("useProjects debe utilizarse dentro de ProjectsProvider.");
  return context;
}