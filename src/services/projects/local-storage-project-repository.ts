import type { Project } from "@/domain/projects/project";
import type { ProjectRepository } from "./project-repository";

const STORAGE_KEY = "broadcast-control.projects.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredProjects {
  version: 1;
  projects: Project[];
  activeProjectId: string | null;
}

const EMPTY_STATE: StoredProjects = { version: 1, projects: [], activeProjectId: null };

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return (
    typeof project.id === "string" &&
    typeof project.workspaceId === "string" &&
    typeof project.name === "string" &&
    Array.isArray(project.itemIds) &&
    project.itemIds.every((id) => typeof id === "string") &&
    typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string"
  );
}

function parseState(raw: string | null): StoredProjects {
  if (!raw) return { ...EMPTY_STATE, projects: [] };

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...EMPTY_STATE, projects: [] };
    const candidate = value as Record<string, unknown>;
    if (candidate.version !== 1 || !Array.isArray(candidate.projects)) {
      return { ...EMPTY_STATE, projects: [] };
    }

    const projects = candidate.projects.filter(isProject);
    const requestedActiveId = typeof candidate.activeProjectId === "string" ? candidate.activeProjectId : null;
    const activeProjectId = projects.some((project) => project.id === requestedActiveId)
      ? requestedActiveId
      : null;
    return { version: 1, projects, activeProjectId };
  } catch {
    return { ...EMPTY_STATE, projects: [] };
  }
}

export function createLocalStorageProjectRepository(storage: KeyValueStorage): ProjectRepository {
  const read = () => parseState(storage.getItem(STORAGE_KEY));
  const write = (state: StoredProjects) => storage.setItem(STORAGE_KEY, JSON.stringify(state));

  return {
    async list() {
      return read().projects.map((project) => ({ ...project, itemIds: [...project.itemIds] }));
    },
    async get(id) {
      const project = read().projects.find((item) => item.id === id);
      return project ? { ...project, itemIds: [...project.itemIds] } : null;
    },
    async create(project) {
      const state = read();
      if (state.projects.some((item) => item.id === project.id)) {
        throw new Error("Ya existe un proyecto con ese identificador.");
      }
      write({ ...state, projects: [...state.projects, project] });
      return { ...project, itemIds: [...project.itemIds] };
    },
    async update(project) {
      const state = read();
      if (!state.projects.some((item) => item.id === project.id)) {
        throw new Error("El proyecto ya no existe.");
      }
      write({ ...state, projects: state.projects.map((item) => (item.id === project.id ? project : item)) });
      return { ...project, itemIds: [...project.itemIds] };
    },
    async delete(id) {
      const state = read();
      write({
        ...state,
        projects: state.projects.filter((project) => project.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      });
    },
    async getActiveProjectId() {
      return read().activeProjectId;
    },
    async setActiveProjectId(projectId) {
      const state = read();
      if (projectId && !state.projects.some((project) => project.id === projectId)) {
        throw new Error("No se puede activar un proyecto inexistente.");
      }
      write({ ...state, activeProjectId: projectId });
    },
  };
}