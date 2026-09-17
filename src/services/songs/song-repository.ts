import type { Song } from "@/domain/songs/song";

export interface SongRepository {
  list(): Promise<Song[]>;
  get(id: string): Promise<Song | null>;
  create(song: Song): Promise<Song>;
  update(song: Song): Promise<Song>;
  delete(id: string): Promise<void>;
}
