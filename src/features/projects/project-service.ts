import type { CreateProjectInput, Project, ProjectFactoryDependencies } from "@/domain/projects/project";
import { createProject, duplicateProject, renameProject, sortProjectsByUpdatedAt } from "@/domain/projects/project-rules";
import type { RundownItem } from "@/domain/projects/rundown";
import { addSongToRundown, moveRundownItem, removeRundownItem } from "@/domain/projects/rundown-rules";
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

  async addSong(projectId: string, song: { id: string; title: string }): Promise<Project> {
    return this.saveRundown(projectId, (rundown) =>
      addSongToRundown(rundown, { songId: song.id, title: song.title }, this.dependencies),
    );
  }

  async removeRundownItem(projectId: string, itemId: string): Promise<Project> {
    return this.saveRundown(projectId, (rundown) => removeRundownItem(rundown, itemId));
  }

  async moveRundownItem(
    projectId: string,
    itemId: string,
    direction: "up" | "down",
  ): Promise<Project> {
    return this.saveRundown(projectId, (rundown) => moveRundownItem(rundown, itemId, direction));
  }

  private async saveRundown(
    projectId: string,
    apply: (rundown: RundownItem[]) => RundownItem[],
  ): Promise<Project> {
    const project = await this.requireProject(projectId);
    return this.repository.update({
      ...project,
      rundown: apply(project.rundown),
      updatedAt: this.dependencies.now(),
    });
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.repository.get(id);
    if (!project) throw new Error("El proyecto ya no existe.");
    return project;
  }
}