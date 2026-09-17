import type { CreateSongInput, Song, SongFactoryDependencies, SongSectionType } from "@/domain/songs/song";
import {
  addSection,
  createSong,
  duplicateSong,
  moveSection,
  normalizeSongTitle,
  removeSection,
  renameSong,
  sortSongsByUpdatedAt,
  updateSection,
  updateSongAuthor,
  type UpdateSectionInput,
} from "@/domain/songs/song-rules";
import type { SongRepository } from "@/services/songs/song-repository";

export class SongService {
  constructor(
    private readonly repository: SongRepository,
    private readonly dependencies: SongFactoryDependencies,
  ) {}

  async load(): Promise<Song[]> {
    return sortSongsByUpdatedAt(await this.repository.list());
  }

  async create(input: CreateSongInput): Promise<Song> {
    return this.repository.create(createSong(input, this.dependencies));
  }

  async rename(id: string, title: string): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(renameSong(song, title, this.dependencies.now));
  }

  async updateAuthor(id: string, author: string | undefined): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(updateSongAuthor(song, author, this.dependencies.now));
  }

  async duplicate(id: string): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.create(duplicateSong(song, this.dependencies));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Persiste un borrador completo (título, autor y secciones). Valida el
   * título y confirma solo cuando el repository confirma la escritura.
   */
  async save(draft: Song): Promise<Song> {
    const existing = await this.requireSong(draft.id);
    const validated: Song = {
      ...draft,
      title: normalizeSongTitle(draft.title),
      workspaceId: existing.workspaceId,
      createdAt: existing.createdAt,
      updatedAt: this.dependencies.now(),
      sections: draft.sections.map((section) => ({ ...section })),
    };
    return this.repository.update(validated);
  }

  async addSection(id: string, type: SongSectionType): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(addSection(song, type, this.dependencies));
  }

  async updateSection(id: string, sectionId: string, input: UpdateSectionInput): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(updateSection(song, sectionId, input, this.dependencies.now));
  }

  async removeSection(id: string, sectionId: string): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(removeSection(song, sectionId, this.dependencies.now));
  }

  async moveSection(id: string, sectionId: string, direction: "up" | "down"): Promise<Song> {
    const song = await this.requireSong(id);
    return this.repository.update(moveSection(song, sectionId, direction, this.dependencies.now));
  }

  private async requireSong(id: string): Promise<Song> {
    const song = await this.repository.get(id);
    if (!song) throw new Error("La canción ya no existe.");
    return song;
  }
}
