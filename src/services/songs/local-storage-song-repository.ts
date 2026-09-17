import type { Song, SongSection } from "@/domain/songs/song";
import type { SongRepository } from "./song-repository";

const STORAGE_KEY = "broadcast-control.songs.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredSongs {
  version: 1;
  songs: Song[];
}

const SECTION_TYPES = new Set(["verse", "chorus", "prechorus", "bridge", "intro", "outro", "custom"]);

function isSection(value: unknown): value is SongSection {
  if (!value || typeof value !== "object") return false;
  const section = value as Record<string, unknown>;
  return (
    typeof section["id"] === "string" &&
    typeof section["type"] === "string" &&
    SECTION_TYPES.has(section["type"]) &&
    typeof section["label"] === "string" &&
    typeof section["content"] === "string" &&
    typeof section["order"] === "number"
  );
}

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Record<string, unknown>;
  return (
    typeof song["id"] === "string" &&
    typeof song["workspaceId"] === "string" &&
    typeof song["title"] === "string" &&
    (song["author"] === undefined || typeof song["author"] === "string") &&
    Array.isArray(song["sections"]) &&
    song["sections"].every(isSection) &&
    typeof song["createdAt"] === "string" &&
    typeof song["updatedAt"] === "string"
  );
}

function parseState(raw: string | null): StoredSongs {
  if (!raw) return { version: 1, songs: [] };

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { version: 1, songs: [] };
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== 1 || !Array.isArray(candidate["songs"])) {
      return { version: 1, songs: [] };
    }
    return { version: 1, songs: candidate["songs"].filter(isSong) };
  } catch {
    return { version: 1, songs: [] };
  }
}

function cloneSong(song: Song): Song {
  return { ...song, sections: song.sections.map((section) => ({ ...section })) };
}

export function createLocalStorageSongRepository(storage: KeyValueStorage): SongRepository {
  const read = () => parseState(storage.getItem(STORAGE_KEY));
  const write = (state: StoredSongs) => storage.setItem(STORAGE_KEY, JSON.stringify(state));

  return {
    async list() {
      return read().songs.map(cloneSong);
    },
    async get(id) {
      const song = read().songs.find((item) => item.id === id);
      return song ? cloneSong(song) : null;
    },
    async create(song) {
      const state = read();
      if (state.songs.some((item) => item.id === song.id)) {
        throw new Error("Ya existe una canción con ese identificador.");
      }
      write({ ...state, songs: [...state.songs, song] });
      return cloneSong(song);
    },
    async update(song) {
      const state = read();
      if (!state.songs.some((item) => item.id === song.id)) {
        throw new Error("La canción ya no existe.");
      }
      write({ ...state, songs: state.songs.map((item) => (item.id === song.id ? song : item)) });
      return cloneSong(song);
    },
    async delete(id) {
      const state = read();
      write({ ...state, songs: state.songs.filter((song) => song.id !== id) });
    },
  };
}
