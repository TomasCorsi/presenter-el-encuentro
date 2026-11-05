import type { PresetRepository } from "@/services/presets/preset-repository";
import { createIndexedDbPresetRepository } from "@/services/presets/indexeddb-preset-repository";
import { createLocalStoragePresetRepository } from "@/services/presets/local-storage-preset-repository";
import type { ProjectRepository } from "@/services/projects/project-repository";
import { createIndexedDbProjectRepository } from "@/services/projects/indexeddb-project-repository";
import { createLocalStorageProjectRepository } from "@/services/projects/local-storage-project-repository";
import type { SongRepository } from "@/services/songs/song-repository";
import { createIndexedDbSongRepository } from "@/services/songs/indexeddb-song-repository";
import { createLocalStorageSongRepository } from "@/services/songs/local-storage-song-repository";
import {
  migratePresets,
  migrateProjects,
  migrateSongs,
  inspectLegacyData,
  type DomainMigrationResult,
} from "./application-migrations";
import { openApplicationDatabase } from "./application-database";
import { LocalDataChangeBus } from "./local-data-change-bus";
import { SyncLocalStore } from "@/services/sync/sync-local-store";

export interface LocalDataRepositories {
  projects: ProjectRepository;
  songs: SongRepository;
  presets: PresetRepository;
}

export interface LocalDataBootstrapResult {
  database: "ready" | "degraded";
  repositories: LocalDataRepositories;
  migrations: DomainMigrationResult[];
  changes: LocalDataChangeBus | null;
  sync: SyncLocalStore | null;
}

export interface BootstrapStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function unavailableProjectRepository(message: string): ProjectRepository {
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  return {
    list: fail,
    get: fail,
    create: fail,
    update: fail,
    delete: fail,
    getActiveProjectId: fail,
    setActiveProjectId: fail,
  };
}

function unavailableSongRepository(message: string): SongRepository {
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  return { list: fail, get: fail, create: fail, update: fail, delete: fail };
}

function unavailablePresetRepository(message: string): PresetRepository {
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  return { list: fail, get: fail, create: fail, update: fail, delete: fail };
}

const bootstraps = new WeakMap<IDBFactory, Promise<LocalDataBootstrapResult>>();

export function bootstrapLocalData(options: {
  factory: IDBFactory;
  storage: BootstrapStorage;
  now?: () => string;
}): Promise<LocalDataBootstrapResult> {
  const existing = bootstraps.get(options.factory);
  if (existing) return existing;
  const bootstrap = performBootstrap(options);
  bootstraps.set(options.factory, bootstrap);
  return bootstrap;
}

async function performBootstrap(options: {
  factory: IDBFactory;
  storage: BootstrapStorage;
  now?: () => string;
}): Promise<LocalDataBootstrapResult> {
  const now = options.now ?? (() => new Date().toISOString());
  try {
    await openApplicationDatabase(options.factory);
  } catch (error) {
    const warning = error instanceof Error ? error.message : "IndexedDB no está disponible.";
    const legacy = inspectLegacyData(options.storage);
    const projectsWarning = legacy.projects.warning ?? warning;
    const songsWarning = legacy.songs.warning ?? warning;
    const presetsWarning = legacy.presets.warning ?? warning;
    return {
      database: "degraded",
      repositories: {
        projects: legacy.projects.usable
          ? createLocalStorageProjectRepository(options.storage)
          : unavailableProjectRepository(projectsWarning),
        songs: legacy.songs.usable
          ? createLocalStorageSongRepository(options.storage)
          : unavailableSongRepository(songsWarning),
        presets: legacy.presets.usable
          ? createLocalStoragePresetRepository(options.storage)
          : unavailablePresetRepository(presetsWarning),
      },
      migrations: (["projects", "songs", "presets"] as const).map((domain) => ({
        domain,
        state: "degraded" as const,
        source: legacy[domain].source,
        count: 0,
        warning: legacy[domain].warning ?? warning,
        legacyUsable: legacy[domain].usable,
      })),
      changes: null,
      sync: null,
    };
  }

  const operations = [
    ["projects", () => migrateProjects(options.factory, options.storage, now)],
    ["songs", () => migrateSongs(options.factory, options.storage, now)],
    ["presets", () => migratePresets(options.factory, options.storage, now)],
  ] as const;

  const migrations: DomainMigrationResult[] = [];
  for (const [domain, operation] of operations) {
    try {
      migrations.push(await operation());
    } catch (error) {
      migrations.push({
        domain,
        state: "degraded",
        source: "empty",
        count: 0,
        warning: error instanceof Error ? error.message : "No se pudo completar la migración.",
        legacyUsable: true,
      });
    }
  }

  const byDomain = new Map(migrations.map((result) => [result.domain, result]));
  const changes = new LocalDataChangeBus();
  const sync = new SyncLocalStore(options.factory, changes, now);
  return {
    database: migrations.every((result) => result.state === "complete") ? "ready" : "degraded",
    repositories: {
      projects:
        byDomain.get("projects")?.state === "complete"
          ? createIndexedDbProjectRepository(options.factory, changes)
          : byDomain.get("projects")?.legacyUsable
            ? createLocalStorageProjectRepository(options.storage)
            : unavailableProjectRepository(
                byDomain.get("projects")?.warning ?? "Projects requiere recuperación manual.",
              ),
      songs:
        byDomain.get("songs")?.state === "complete"
          ? createIndexedDbSongRepository(options.factory, changes)
          : byDomain.get("songs")?.legacyUsable
            ? createLocalStorageSongRepository(options.storage)
            : unavailableSongRepository(
                byDomain.get("songs")?.warning ?? "Songs requiere recuperación manual.",
              ),
      presets:
        byDomain.get("presets")?.state === "complete"
          ? createIndexedDbPresetRepository(options.factory, changes)
          : byDomain.get("presets")?.legacyUsable
            ? createLocalStoragePresetRepository(options.storage)
            : unavailablePresetRepository(
                byDomain.get("presets")?.warning ?? "Presets requiere recuperación manual.",
              ),
    },
    migrations,
    changes,
    sync,
  };
}
