import type { CreateProjectInput, Project, ProjectFactoryDependencies } from "@/domain/projects/project";
import { createProject, duplicateProject, renameProject, sortProjectsByUpdatedAt } from "@/domain/projects/project-rules";
import type { RundownBackground, RundownItem } from "@/domain/projects/rundown";
import type { BiblePassage } from "@/domain/bible/bible";
import { addMediaToRundown, addPassageToRundown, addSongToRundown, moveRundownItem, removeRundownItem, setRundownItemBackground, setRundownItemPreset } from "@/domain/projects/rundown-rules";
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

  /** Agrega un pasaje bíblico congelado al rundown (ADR-042). */
  async addPassage(projectId: string, passage: BiblePassage): Promise<Project> {
    return this.saveRundown(projectId, (rundown) =>
      addPassageToRundown(rundown, passage, this.dependencies),
    );
  }

  /** Agrega una referencia a un archivo de Media (Fase 10; solo referencia). */
  async addMedia(projectId: string, media: { id: string; name: string }): Promise<Project> {
    return this.saveRundown(projectId, (rundown) =>
      addMediaToRundown(rundown, { mediaId: media.id, name: media.name }, this.dependencies),
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

  /** Asigna el Preset de UNA aparición del rundown (ADR-034). */
  async setRundownItemPreset(
    projectId: string,
    itemId: string,
    presetId: string | undefined,
  ): Promise<Project> {
    return this.saveRundown(projectId, (rundown) =>
      setRundownItemPreset(rundown, itemId, presetId),
    );
  }

  async setRundownItemBackground(
    projectId: string,
    itemId: string,
    background: RundownBackground | undefined,
  ): Promise<Project> {
    return this.saveRundown(projectId, (rundown) =>
      setRundownItemBackground(rundown, itemId, background),
    );
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
