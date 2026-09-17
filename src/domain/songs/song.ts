import { LOCAL_WORKSPACE_ID } from "@/domain/projects/project";

export { LOCAL_WORKSPACE_ID };

export const SONG_TITLE_MAX_LENGTH = 120;

export type SongSectionType =
  | "verse"
  | "chorus"
  | "prechorus"
  | "bridge"
  | "intro"
  | "outro"
  | "custom";

export interface SongSection {
  id: string;
  type: SongSectionType;
  label: string;
  content: string;
  order: number;
}

export interface Song {
  id: string;
  workspaceId: string;
  title: string;
  author?: string | undefined;
  sections: SongSection[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSongInput {
  title: string;
  author?: string;
  workspaceId?: string;
}

export interface SongFactoryDependencies {
  createId: () => string;
  now: () => string;
}
