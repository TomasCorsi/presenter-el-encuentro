import {
  LOCAL_WORKSPACE_ID,
  PROJECT_NAME_MAX_LENGTH,
  type CreateProjectInput,
  type Project,
  type ProjectFactoryDependencies,
} from "./project";
import { duplicateRundown } from "./rundown-rules";

export class ProjectNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectNameError";
  }
}

export function normalizeProjectName(value: string): string {
  const name = value.trim();

  if (!name) throw new ProjectNameError("El nombre del proyecto es obligatorio.");
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    throw new ProjectNameError(`El nombre no puede superar ${PROJECT_NAME_MAX_LENGTH} caracteres.`);
  }

  return name;
}

export function createProject(
  input: CreateProjectInput,
  dependencies: ProjectFactoryDependencies,
): Project {
  const timestamp = dependencies.now();

  return {
    id: dependencies.createId(),
    workspaceId: input.workspaceId ?? LOCAL_WORKSPACE_ID,
    name: normalizeProjectName(input.name),
    rundown: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function renameProject(project: Project, name: string, now: () => string): Project {
  return { ...project, name: normalizeProjectName(name), updatedAt: now() };
}

export function duplicateProject(
  project: Project,
  dependencies: ProjectFactoryDependencies,
): Project {
  const timestamp = dependencies.now();
  const suffix = " — copia";
  const copiedName = `${project.name.slice(0, PROJECT_NAME_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;

  return {
    ...project,
    id: dependencies.createId(),
    name: normalizeProjectName(copiedName),
    rundown: duplicateRundown(project.rundown, dependencies),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function filterProjects(projects: Project[], query: string): Project[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...projects];
  return projects.filter((project) => project.name.toLocaleLowerCase().includes(normalizedQuery));
}

export function sortProjectsByUpdatedAt(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}