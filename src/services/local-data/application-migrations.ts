import { isBiblePassage } from "@/domain/bible/bible";
import { DEFAULT_PRESET_ID, type Preset } from "@/domain/presets/preset";
import { normalizePresetStyle } from "@/domain/presets/preset-rules";
import type { Project } from "@/domain/projects/project";
import type { RundownItem, RundownItemType } from "@/domain/projects/rundown";
import { normalizeRundown } from "@/domain/projects/rundown-rules";
import type { Song, SongSection } from "@/domain/songs/song";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
  type ApplicationMetaRecord,
} from "./application-database";
import { ACTIVE_PROJECT_META_KEY } from "@/services/projects/indexeddb-project-repository";

export const PROJECTS_V2_KEY = "broadcast-control.projects.v2";
export const PROJECTS_V1_KEY = "broadcast-control.projects.v1";
export const SONGS_V1_KEY = "broadcast-control.songs.v1";
export const PRESETS_V1_KEY = "broadcast-control.presets.v1";

export const MIGRATION_MARKERS = {
  projects: "migration.projects.local-storage-v2",
  songs: "migration.songs.local-storage-v1",
  presets: "migration.presets.local-storage-v1",
} as const;

export type LocalDataDomain = keyof typeof MIGRATION_MARKERS;
export type MigrationState = "complete" | "degraded";

export interface DomainMigrationResult {
  domain: LocalDataDomain;
  state: MigrationState;
  source: "indexeddb" | "local-storage-v2" | "local-storage-v1" | "empty";
  count: number;
  warning?: string;
  legacyUsable?: boolean;
}

interface MigrationMarkerValue {
  completedAt: string;
  source: DomainMigrationResult["source"];
  count: number;
  warning?: string;
}

export interface ReadonlyKeyValueStorage {
  getItem(key: string): string | null;
}

type ParsedLegacy<T> =
  | { status: "absent" }
  | { status: "invalid"; reason: string }
  | { status: "valid"; values: T[]; activeProjectId?: string | null };

export interface LegacyDomainInspection {
  usable: boolean;
  source: DomainMigrationResult["source"];
  warning?: string;
}

const RUNDOWN_TYPES = new Set<RundownItemType>([
  "song",
  "bible",
  "media",
  "presentation",
  "countdown",
  "message",
]);
const SECTION_TYPES = new Set(["verse", "chorus", "prechorus", "bridge", "intro", "outro", "custom"]);

function parseRundownItem(value: unknown): RundownItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item["id"] !== "string" ||
    typeof item["sourceId"] !== "string" ||
    typeof item["title"] !== "string" ||
    typeof item["order"] !== "number" ||
    !RUNDOWN_TYPES.has(item["type"] as RundownItemType) ||
    (item["presetId"] !== undefined && typeof item["presetId"] !== "string")
  ) return null;

  if (item["payload"] !== undefined) {
    const payload = item["payload"];
    if (!payload || typeof payload !== "object") return null;
    const candidate = payload as Record<string, unknown>;
    if (candidate["kind"] !== "bible" || !isBiblePassage(candidate["passage"])) return null;
  }

  const parsed: RundownItem = {
    id: item["id"],
    sourceId: item["sourceId"],
    title: item["title"],
    order: item["order"],
    type: item["type"] as RundownItemType,
  };
  if (typeof item["presetId"] === "string") parsed.presetId = item["presetId"];
  if (item["payload"] !== undefined) parsed.payload = structuredClone(item["payload"]) as RundownItem["payload"];
  if (parsed.type === "song" || parsed.type === "bible") {
    const background = item["background"];
    if (background !== undefined) {
      if (!background || typeof background !== "object") return null;
      const candidate = background as Record<string, unknown>;
      if (candidate["type"] !== "media" || typeof candidate["mediaId"] !== "string") return null;
      parsed.background = { type: "media", mediaId: candidate["mediaId"] };
    }
  }
  return parsed;
}

function parseProject(value: unknown, version: 1 | 2): Project | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item["id"] !== "string" ||
    typeof item["workspaceId"] !== "string" ||
    typeof item["name"] !== "string" ||
    typeof item["createdAt"] !== "string" ||
    typeof item["updatedAt"] !== "string"
  ) return null;

  let rundown: RundownItem[] = [];
  if (version === 2) {
    if (!Array.isArray(item["rundown"])) return null;
    const parsed = item["rundown"].map(parseRundownItem);
    if (parsed.some((entry) => entry === null)) return null;
    rundown = normalizeRundown(parsed as RundownItem[]);
  }

  return {
    id: item["id"],
    workspaceId: item["workspaceId"],
    name: item["name"],
    ...(typeof item["eventDate"] === "string" ? { eventDate: item["eventDate"] } : {}),
    rundown,
    createdAt: item["createdAt"],
    updatedAt: item["updatedAt"],
  };
}

function parseProjects(raw: string | null, version: 1 | 2): ParsedLegacy<Project> {
  if (raw === null) return { status: "absent" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { status: "invalid", reason: "El payload no es un objeto." };
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== version || !Array.isArray(candidate["projects"])) {
      return { status: "invalid", reason: "La versión o colección de Projects es inválida." };
    }
    const projects = candidate["projects"].map((entry) => parseProject(entry, version));
    if (projects.some((entry) => entry === null)) {
      return { status: "invalid", reason: "Projects contiene una entidad inválida; no se migró nada." };
    }
    const values = projects as Project[];
    const requested = typeof candidate["activeProjectId"] === "string" ? candidate["activeProjectId"] : null;
    return {
      status: "valid",
      values,
      activeProjectId: values.some((project) => project.id === requested) ? requested : null,
    };
  } catch {
    return { status: "invalid", reason: "Projects contiene JSON inválido." };
  }
}

function parseSongSection(value: unknown): value is SongSection {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item["id"] === "string" && typeof item["type"] === "string" &&
    SECTION_TYPES.has(item["type"]) && typeof item["label"] === "string" &&
    typeof item["content"] === "string" && typeof item["order"] === "number";
}

function parseSong(value: unknown): Song | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item["id"] !== "string" || typeof item["workspaceId"] !== "string" ||
    typeof item["title"] !== "string" ||
    (item["author"] !== undefined && typeof item["author"] !== "string") ||
    !Array.isArray(item["sections"]) || !item["sections"].every(parseSongSection) ||
    typeof item["createdAt"] !== "string" || typeof item["updatedAt"] !== "string"
  ) return null;
  return structuredClone(item) as unknown as Song;
}

function parseSongs(raw: string | null): ParsedLegacy<Song> {
  if (raw === null) return { status: "absent" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { status: "invalid", reason: "El payload no es un objeto." };
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== 1 || !Array.isArray(candidate["songs"])) {
      return { status: "invalid", reason: "La versión o colección de Songs es inválida." };
    }
    const songs = candidate["songs"].map(parseSong);
    if (songs.some((entry) => entry === null)) {
      return { status: "invalid", reason: "Songs contiene una entidad inválida; no se migró nada." };
    }
    return { status: "valid", values: songs as Song[] };
  } catch {
    return { status: "invalid", reason: "Songs contiene JSON inválido." };
  }
}

function parsePreset(value: unknown): Preset | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item["id"] !== "string" || item["id"] === "" || item["id"] === DEFAULT_PRESET_ID ||
    typeof item["workspaceId"] !== "string" || typeof item["name"] !== "string" ||
    typeof item["createdAt"] !== "string" || typeof item["updatedAt"] !== "string"
  ) return null;
  return {
    id: item["id"], workspaceId: item["workspaceId"], name: item["name"],
    style: normalizePresetStyle(item["style"]),
    createdAt: item["createdAt"], updatedAt: item["updatedAt"],
  };
}

function parsePresets(raw: string | null): ParsedLegacy<Preset> {
  if (raw === null) return { status: "absent" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { status: "invalid", reason: "El payload no es un objeto." };
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== 1 || !Array.isArray(candidate["presets"])) {
      return { status: "invalid", reason: "La versión o colección de Presets es inválida." };
    }
    const presets = candidate["presets"].map(parsePreset);
    if (presets.some((entry) => entry === null)) {
      return { status: "invalid", reason: "Presets contiene una entidad inválida; no se migró nada." };
    }
    return { status: "valid", values: presets as Preset[] };
  } catch {
    return { status: "invalid", reason: "Presets contiene JSON inválido." };
  }
}

export function inspectLegacyData(storage: ReadonlyKeyValueStorage): Record<LocalDataDomain, LegacyDomainInspection> {
  const projectsV2 = parseProjects(storage.getItem(PROJECTS_V2_KEY), 2);
  const projectsV1 = parseProjects(storage.getItem(PROJECTS_V1_KEY), 1);
  const songs = parseSongs(storage.getItem(SONGS_V1_KEY));
  const presets = parsePresets(storage.getItem(PRESETS_V1_KEY));
  const projectFallback = projectsV2.status === "invalid" && projectsV1.status === "valid";
  const projectSource = projectsV2.status === "valid"
    ? "local-storage-v2"
    : projectsV1.status === "valid" ? "local-storage-v1" : "empty";
  return {
    projects: {
      usable: projectsV2.status !== "invalid" || projectFallback,
      source: projectSource,
      ...(projectsV2.status === "invalid" && !projectFallback ? { warning: projectsV2.reason } : {}),
    },
    songs: {
      usable: songs.status !== "invalid",
      source: songs.status === "absent" ? "empty" : "local-storage-v1",
      ...(songs.status === "invalid" ? { warning: songs.reason } : {}),
    },
    presets: {
      usable: presets.status !== "invalid",
      source: presets.status === "absent" ? "empty" : "local-storage-v1",
      ...(presets.status === "invalid" ? { warning: presets.reason } : {}),
    },
  };
}

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(
  indexedDbValues: readonly T[], legacyValues: readonly T[],
): T[] {
  const merged = new Map(indexedDbValues.map((value) => [value.id, value]));
  for (const legacy of legacyValues) {
    const current = merged.get(legacy.id);
    if (!current || legacy.updatedAt > current.updatedAt) merged.set(legacy.id, legacy);
  }
  return [...merged.values()];
}

async function existingMarker(
  database: IDBDatabase, domain: LocalDataDomain,
): Promise<MigrationMarkerValue | null> {
  const record = await idbRequest<ApplicationMetaRecord<MigrationMarkerValue> | undefined>(
    database.transaction(APPLICATION_STORES.meta).objectStore(APPLICATION_STORES.meta).get(MIGRATION_MARKERS[domain]),
  );
  return record?.value ?? null;
}

async function migrateValues<T extends { id: string; updatedAt: string }>(options: {
  factory: IDBFactory;
  domain: LocalDataDomain;
  storeName: string;
  parsed: ParsedLegacy<T>;
  source: DomainMigrationResult["source"];
  now: () => string;
  warning?: string;
}): Promise<DomainMigrationResult> {
  const database = await openApplicationDatabase(options.factory);
  const marker = await existingMarker(database, options.domain);
  if (marker) return { domain: options.domain, state: "complete", ...marker };
  if (options.parsed.status === "invalid") {
    return {
      domain: options.domain, state: "degraded", source: options.source, count: 0,
      warning: options.parsed.reason,
      legacyUsable: false,
    };
  }

  const transaction = database.transaction(
    [options.storeName, APPLICATION_STORES.meta], "readwrite",
  );
  const completed = idbTransactionDone(transaction);
  try {
    const store = transaction.objectStore(options.storeName);
    const legacyValues = options.parsed.status === "valid" ? options.parsed.values : [];
    const existing = await idbRequest<T[]>(store.getAll());
    const merged = mergeByUpdatedAt(existing, legacyValues);
    for (const value of merged) store.put(structuredClone(value));

    if (options.domain === "projects") {
      const meta = transaction.objectStore(APPLICATION_STORES.meta);
      const currentActive = await idbRequest<ApplicationMetaRecord<string | null> | undefined>(
        meta.get(ACTIVE_PROJECT_META_KEY),
      );
      const requested = currentActive
        ? currentActive.value
        : options.parsed.status === "valid" ? options.parsed.activeProjectId ?? null : null;
      const activeProjectId = merged.some((value) => value.id === requested) ? requested : null;
      meta.put({ key: ACTIVE_PROJECT_META_KEY, value: activeProjectId } satisfies ApplicationMetaRecord);
    }

    const markerValue: MigrationMarkerValue = {
      completedAt: options.now(), source: options.source, count: merged.length,
      ...(options.warning ? { warning: options.warning } : {}),
    };
    transaction.objectStore(APPLICATION_STORES.meta).put({
      key: MIGRATION_MARKERS[options.domain], value: markerValue,
    } satisfies ApplicationMetaRecord);
    await completed;
    return { domain: options.domain, state: "complete", ...markerValue };
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // La transacción puede haber finalizado entre el error y este cleanup.
    }
    await completed.catch(() => undefined);
    throw error;
  }
}

export async function migrateProjects(
  factory: IDBFactory, storage: ReadonlyKeyValueStorage, now = () => new Date().toISOString(),
): Promise<DomainMigrationResult> {
  const v2 = parseProjects(storage.getItem(PROJECTS_V2_KEY), 2);
  let parsed = v2;
  let source: DomainMigrationResult["source"] = v2.status === "absent" ? "empty" : "local-storage-v2";
  let warning: string | undefined;
  if (v2.status !== "valid") {
    const v1 = parseProjects(storage.getItem(PROJECTS_V1_KEY), 1);
    if (v2.status === "absent" && v1.status === "valid") {
      parsed = v1;
      source = "local-storage-v1";
    } else if (v2.status === "invalid" && v1.status === "valid") {
      parsed = v1;
      source = "local-storage-v1";
      warning = "Projects v2 era inválido; se recuperó v1 sin modificar ninguna clave legacy.";
    } else if (v2.status === "absent" && v1.status === "invalid") {
      parsed = v1;
      source = "local-storage-v1";
    }
  }
  return migrateValues({ factory, domain: "projects", storeName: APPLICATION_STORES.projects, parsed, source, now, ...(warning ? { warning } : {}) });
}

export function migrateSongs(factory: IDBFactory, storage: ReadonlyKeyValueStorage, now = () => new Date().toISOString()) {
  const parsed = parseSongs(storage.getItem(SONGS_V1_KEY));
  return migrateValues({ factory, domain: "songs", storeName: APPLICATION_STORES.songs, parsed, source: parsed.status === "absent" ? "empty" : "local-storage-v1", now });
}

export function migratePresets(factory: IDBFactory, storage: ReadonlyKeyValueStorage, now = () => new Date().toISOString()) {
  const parsed = parsePresets(storage.getItem(PRESETS_V1_KEY));
  return migrateValues({ factory, domain: "presets", storeName: APPLICATION_STORES.presets, parsed, source: parsed.status === "absent" ? "empty" : "local-storage-v1", now });
}
