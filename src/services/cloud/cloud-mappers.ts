import { z } from "zod";

import type { Project } from "@/domain/projects/project";
import { PROJECT_NAME_MAX_LENGTH } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import { SONG_TITLE_MAX_LENGTH } from "@/domain/songs/song";
import type { Preset } from "@/domain/presets/preset";
import { PRESET_NAME_MAX_LENGTH } from "@/domain/presets/preset";
import { CloudRepositoryError } from "./cloud-error";

export const CLOUD_PAYLOAD_MAX_BYTES = 1024 * 1024;

const nonEmpty = z.string().min(1);
const timestamp = z.string().datetime({ offset: true });
const bibleVerseSchema = z.object({ number: nonEmpty, lines: z.array(z.string()) });
const biblePassageSchema = z.object({
  versionId: nonEmpty,
  versionAbbreviation: nonEmpty,
  bookUsfm: nonEmpty,
  bookName: nonEmpty,
  chapter: nonEmpty,
  reference: nonEmpty,
  verses: z.array(bibleVerseSchema).min(1),
});
const rundownItemSchema = z.object({
  id: nonEmpty,
  type: z.enum(["song", "bible", "media", "presentation", "countdown", "message"]),
  sourceId: nonEmpty,
  title: z.string(),
  order: z.number().int().nonnegative(),
  presetId: nonEmpty.optional(),
  background: z.object({ type: z.literal("media"), mediaId: nonEmpty }).optional(),
  payload: z.object({ kind: z.literal("bible"), passage: biblePassageSchema }).optional(),
});
const songSectionSchema = z.object({
  id: nonEmpty,
  type: z.enum(["verse", "chorus", "prechorus", "bridge", "intro", "outro", "custom"]),
  label: z.string(),
  content: z.string(),
  order: z.number().int().nonnegative(),
});
const presetStyleSchema = z.object({
  fontFamily: z.enum(["sans", "serif", "mono"]),
  fontSize: z.number().min(1).max(30),
  fontWeight: z.union([z.literal(400), z.literal(600), z.literal(700)]),
  lineHeight: z.number().min(1).max(2),
  align: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "center", "bottom"]),
  textColor: z.string(),
  background: z.object({ type: z.literal("solid"), color: z.string() }),
  safeAreaX: z.number().min(0).max(20),
  safeAreaY: z.number().min(0).max(20),
});

const projectPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  eventDate: z.string().optional(),
  rundown: z.array(rundownItemSchema),
});
const songPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  author: z.string().optional(),
  sections: z.array(songSectionSchema),
});
const presetPayloadSchema = z.object({ schemaVersion: z.literal(1), style: presetStyleSchema });

const baseRowSchema = z.object({
  workspace_id: nonEmpty,
  id: nonEmpty,
  entity_created_at: timestamp,
  entity_updated_at: timestamp,
});
const projectRowSchema = baseRowSchema.extend({
  name: z.string().min(1).max(PROJECT_NAME_MAX_LENGTH),
  payload: projectPayloadSchema,
});
const songRowSchema = baseRowSchema.extend({
  title: z.string().min(1).max(SONG_TITLE_MAX_LENGTH),
  payload: songPayloadSchema,
});
const presetRowSchema = baseRowSchema.extend({
  name: z.string().min(1).max(PRESET_NAME_MAX_LENGTH),
  payload: presetPayloadSchema,
});

export type CloudWritableRecord = Record<string, unknown> & {
  workspace_id: string;
  id: string;
  entity_created_at: string;
  entity_updated_at: string;
};

function assertPayloadSize(payload: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > CLOUD_PAYLOAD_MAX_BYTES) {
    throw new CloudRepositoryError("validation", "El payload cloud supera el límite de 1 MiB.");
  }
}

export function projectToCloudRecord(project: Project, workspaceId: string): CloudWritableRecord {
  const payload = projectPayloadSchema.parse({
    schemaVersion: 1,
    ...(project.eventDate ? { eventDate: project.eventDate } : {}),
    rundown: project.rundown,
  });
  assertPayloadSize(payload);
  return {
    workspace_id: workspaceId,
    id: nonEmpty.parse(project.id),
    name: z.string().min(1).max(PROJECT_NAME_MAX_LENGTH).parse(project.name),
    payload,
    entity_created_at: timestamp.parse(project.createdAt),
    entity_updated_at: timestamp.parse(project.updatedAt),
  };
}

export function projectFromCloudRow(value: unknown): Project {
  const row = projectRowSchema.parse(value);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    ...(row.payload.eventDate ? { eventDate: row.payload.eventDate } : {}),
    rundown: structuredClone(row.payload.rundown),
    createdAt: row.entity_created_at,
    updatedAt: row.entity_updated_at,
  };
}

export function songToCloudRecord(song: Song, workspaceId: string): CloudWritableRecord {
  const payload = songPayloadSchema.parse({
    schemaVersion: 1,
    ...(song.author ? { author: song.author } : {}),
    sections: song.sections,
  });
  assertPayloadSize(payload);
  return {
    workspace_id: workspaceId,
    id: nonEmpty.parse(song.id),
    title: z.string().min(1).max(SONG_TITLE_MAX_LENGTH).parse(song.title),
    payload,
    entity_created_at: timestamp.parse(song.createdAt),
    entity_updated_at: timestamp.parse(song.updatedAt),
  };
}

export function songFromCloudRow(value: unknown): Song {
  const row = songRowSchema.parse(value);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    ...(row.payload.author ? { author: row.payload.author } : {}),
    sections: structuredClone(row.payload.sections),
    createdAt: row.entity_created_at,
    updatedAt: row.entity_updated_at,
  };
}

export function presetToCloudRecord(preset: Preset, workspaceId: string): CloudWritableRecord {
  const payload = presetPayloadSchema.parse({ schemaVersion: 1, style: preset.style });
  assertPayloadSize(payload);
  return {
    workspace_id: workspaceId,
    id: nonEmpty.parse(preset.id),
    name: z.string().min(1).max(PRESET_NAME_MAX_LENGTH).parse(preset.name),
    payload,
    entity_created_at: timestamp.parse(preset.createdAt),
    entity_updated_at: timestamp.parse(preset.updatedAt),
  };
}

export function presetFromCloudRow(value: unknown): Preset {
  const row = presetRowSchema.parse(value);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    style: structuredClone(row.payload.style),
    createdAt: row.entity_created_at,
    updatedAt: row.entity_updated_at,
  };
}
