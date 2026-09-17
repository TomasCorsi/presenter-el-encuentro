import type { Project } from "@/domain/projects/project";
import type { RundownItem, RundownItemType } from "@/domain/projects/rundown";
import { normalizeRundown } from "@/domain/projects/rundown-rules";
import type { ProjectRepository } from "./project-repository";

/** Clave anterior (Fase 2-4). Se conserva como respaldo tras migrar (ADR-019). */
export const LEGACY_STORAGE_KEY_V1 = "broadcast-control.projects.v1";
export const STORAGE_KEY = "broadcast-control.projects.v2";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredProjects {
  version: 2;
  projects: Project[];
  activeProjectId: string | null;
}

const EMPTY_STATE: StoredProjects = { version: 2, projects: [], activeProjectId: null };

const RUNDOWN_ITEM_TYPES: readonly RundownItemType[] = [
  "song",
  "bible",
  "media",
  "presentation",
  "countdown",
  "message",
];

function isRundownItem(value: unknown): value is RundownItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["id"] === "string" &&
    typeof item["sourceId"] === "string" &&
    typeof item["title"] === "string" &&
    typeof item["order"] === "number" &&
    (item["presetId"] === undefined || typeof item["presetId"] === "string") &&
    RUNDOWN_ITEM_TYPES.includes(item["type"] as RundownItemType)
  );
}

/**
 * Validación defensiva y NO destructiva a nivel de lista: un rundown ausente o
 * inválido pasa a `[]`, y los items inválidos individuales se descartan sin
 * perder los válidos.
 */
function parseProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate["id"] !== "string" ||
    typeof candidate["workspaceId"] !== "string" ||
    typeof candidate["name"] !== "string" ||
    typeof candidate["createdAt"] !== "string" ||
    typeof candidate["updatedAt"] !== "string"
  ) {
    return null;
  }

  const rawRundown = candidate["rundown"];
  const rundown = Array.isArray(rawRundown) ? normalizeRundown(rawRundown.filter(isRundownItem)) : [];

  const project: Project = {
    id: candidate["id"],
    workspaceId: candidate["workspaceId"],
    name: candidate["name"],
    rundown,
    createdAt: candidate["createdAt"],
    updatedAt: candidate["updatedAt"],
  };

  if (typeof candidate["eventDate"] === "string") project.eventDate = candidate["eventDate"];

  return project;
}

function parsePayload(raw: string | null, expectedVersion: 1 | 2): StoredProjects | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== expectedVersion || !Array.isArray(candidate["projects"])) return null;

    const projects = candidate["projects"]
      .map(parseProject)
      .filter((project): project is Project => project !== null);
    const requestedActiveId =
      typeof candidate["activeProjectId"] === "string" ? candidate["activeProjectId"] : null;

    return {
      version: 2,
      projects,
      activeProjectId: projects.some((project) => project.id === requestedActiveId)
        ? requestedActiveId
        : null,
    };
  } catch {
    return null;
  }
}

function cloneProject(project: Project): Project {
  return { ...project, rundown: project.rundown.map((item) => ({ ...item })) };
}

export function createLocalStorageProjectRepository(storage: KeyValueStorage): ProjectRepository {
  const write = (state: StoredProjects) => storage.setItem(STORAGE_KEY, JSON.stringify(state));

  const read = (): StoredProjects => {
    const current = parsePayload(storage.getItem(STORAGE_KEY), 2);
    if (current) return current;

    // Migración v1 → v2: los projects antiguos no tienen rundown y su
    // `itemIds` (placeholder nunca usado) se descarta. La clave v1 se conserva.
    const legacy = parsePayload(storage.getItem(LEGACY_STORAGE_KEY_V1), 1);
    if (legacy) {
      write(legacy);
      return legacy;
    }

    return { ...EMPTY_STATE, projects: [] };
  };

  return {
    async list() {
      return read().projects.map(cloneProject);
    },
    async get(id) {
      const project = read().projects.find((item) => item.id === id);
      return project ? cloneProject(project) : null;
    },
    async create(project) {
      const state = read();
      if (state.projects.some((item) => item.id === project.id)) {
        throw new Error("Ya existe un proyecto con ese identificador.");
      }
      write({ ...state, projects: [...state.projects, project] });
      return cloneProject(project);
    },
    async update(project) {
      const state = read();
      if (!state.projects.some((item) => item.id === project.id)) {
        throw new Error("El proyecto ya no existe.");
      }
      write({
        ...state,
        projects: state.projects.map((item) => (item.id === project.id ? project : item)),
      });
      return cloneProject(project);
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
