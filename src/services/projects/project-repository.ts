import type { Project } from "@/domain/projects/project";

export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(project: Project): Promise<Project>;
  update(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
  getActiveProjectId(): Promise<string | null>;
  setActiveProjectId(projectId: string | null): Promise<void>;
}