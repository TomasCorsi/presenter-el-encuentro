import type { CreateProjectInput, Project, ProjectFactoryDependencies } from "@/domain/projects/project";
import { createProject, duplicateProject, renameProject, sortProjectsByUpdatedAt } from "@/domain/projects/project-rules";
import type { ProjectRepository } from "@/services/projects/project-repository";

export interface ProjectsSnapshot {
  projects: Project[];
  activeProjectId: string | null;
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly dependencies: ProjectFactoryDependencies,
  ) {}

  async load(): Promise<ProjectsSnapshot> {
    const [projects, activeProjectId] = await Promise.all([
      this.repository.list(),
      this.repository.getActiveProjectId(),
    ]);
    return { projects: sortProjectsByUpdatedAt(projects), activeProjectId };
  }

  async create(input: CreateProjectInput): Promise<Project> {
    return this.repository.create(createProject(input, this.dependencies));
  }

  async rename(id: string, name: string): Promise<Project> {
    const project = await this.requireProject(id);
    return this.repository.update(renameProject(project, name, this.dependencies.now));
  }

  async duplicate(id: string): Promise<Project> {
    const project = await this.requireProject(id);
    return this.repository.create(duplicateProject(project, this.dependencies));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async setActiveProject(id: string | null): Promise<void> {
    await this.repository.setActiveProjectId(id);
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.repository.get(id);
    if (!project) throw new Error("El proyecto ya no existe.");
    return project;
  }
}