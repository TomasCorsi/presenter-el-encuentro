import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import type { Preset } from "@/domain/presets/preset";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import type { SyncConflict, SyncLink, SyncQueueEntry } from "@/domain/sync/sync";
import {
  APPLICATION_STORES,
  idbRequest,
  openApplicationDatabase,
  type ApplicationMetaRecord,
} from "@/services/local-data/application-database";
import {
  BIBLE_BOOKS_STORE,
  BIBLE_CHAPTERS_STORE,
  BIBLE_DB_NAME,
  BIBLE_VERSIONS_STORE,
} from "@/services/bible/indexeddb-bible-repository";
import {
  MEDIA_ASSETS_STORE,
  MEDIA_COLLECTIONS_STORE,
  MEDIA_DB_NAME,
} from "@/services/media/indexeddb-media-repository";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import { ACTIVE_PROJECT_META_KEY } from "@/services/projects/indexeddb-project-repository";
import { ACTIVE_SYNC_LINK_META_KEY } from "@/services/sync/sync-journal";
import {
  BACKGROUND_PREFERENCES_KEY,
  parseBackgroundPreferences,
} from "@/features/live/background-preferences";
import {
  LIBRARY_DOCK_HEIGHT_KEY,
  parseLibraryDockPreference,
} from "@/features/live/library-dock-height";
import { LIBRARY_PREFERENCE_KEY, parseLibraryPreference } from "@/features/live/library-preference";
import {
  MEDIA_LIBRARY_PREFERENCES_KEY,
  parseMediaLibraryPreferences,
} from "@/features/media/media-library-preferences";
import type { BackupPreferences } from "@/domain/backup/backup";

export interface LocalBackupSnapshot {
  projects: Project[];
  songs: Song[];
  presets: Preset[];
  mediaAssets: MediaAsset[];
  mediaCollections: MediaCollection[];
  bibleVersions: unknown[];
  bibleBooks: unknown[];
  bibleChapters: unknown[];
  preferences: BackupPreferences;
  syncSummary: {
    hadActiveSyncLink: boolean;
    pendingSyncOperations: number;
    conflictCount: number;
  };
  mediaFiles: Map<string, Blob>;
}

async function openExisting(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`No se pudo abrir ${name}.`));
  });
}

async function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  if (!db.objectStoreNames.contains(store)) return [];
  return idbRequest<T[]>(db.transaction(store).objectStore(store).getAll());
}

export async function readLocalBackupSnapshot(options: {
  factory: IDBFactory;
  storage: Pick<Storage, "getItem">;
  mediaStorage: MediaFileStorage;
  includeMediaBytes: boolean;
  signal?: AbortSignal;
}): Promise<LocalBackupSnapshot> {
  const app = await openApplicationDatabase(options.factory);
  const appTransaction = app.transaction([
    APPLICATION_STORES.projects,
    APPLICATION_STORES.songs,
    APPLICATION_STORES.presets,
    APPLICATION_STORES.meta,
    APPLICATION_STORES.syncLinks,
    APPLICATION_STORES.syncQueue,
    APPLICATION_STORES.syncConflicts,
  ]);
  const [projects, songs, presets, meta, links, queue, conflicts] = await Promise.all([
    idbRequest<Project[]>(appTransaction.objectStore(APPLICATION_STORES.projects).getAll()),
    idbRequest<Song[]>(appTransaction.objectStore(APPLICATION_STORES.songs).getAll()),
    idbRequest<Preset[]>(appTransaction.objectStore(APPLICATION_STORES.presets).getAll()),
    idbRequest<ApplicationMetaRecord[]>(
      appTransaction.objectStore(APPLICATION_STORES.meta).getAll(),
    ),
    idbRequest<SyncLink[]>(appTransaction.objectStore(APPLICATION_STORES.syncLinks).getAll()),
    idbRequest<SyncQueueEntry[]>(appTransaction.objectStore(APPLICATION_STORES.syncQueue).getAll()),
    idbRequest<SyncConflict[]>(
      appTransaction.objectStore(APPLICATION_STORES.syncConflicts).getAll(),
    ),
  ]);
  const activeProjectId = meta.find((item) => item.key === ACTIVE_PROJECT_META_KEY)?.value;
  const activeSyncLinkKey = meta.find((item) => item.key === ACTIVE_SYNC_LINK_META_KEY)?.value;

  const mediaDb = await openExisting(options.factory, MEDIA_DB_NAME);
  const bibleDb = await openExisting(options.factory, BIBLE_DB_NAME);
  const [mediaAssets, mediaCollections, bibleVersions, bibleBooks, bibleChapters] =
    await Promise.all([
      getAll<MediaAsset>(mediaDb, MEDIA_ASSETS_STORE),
      getAll<MediaCollection>(mediaDb, MEDIA_COLLECTIONS_STORE),
      getAll<unknown>(bibleDb, BIBLE_VERSIONS_STORE),
      getAll<unknown>(bibleDb, BIBLE_BOOKS_STORE),
      getAll<unknown>(bibleDb, BIBLE_CHAPTERS_STORE),
    ]);
  mediaDb.close();
  bibleDb.close();

  const mediaFiles = new Map<string, Blob>();
  if (options.includeMediaBytes) {
    for (const asset of mediaAssets) {
      options.signal?.throwIfAborted();
      const blob = await options.mediaStorage.get(asset.id);
      if (!blob || blob.size !== asset.sizeBytes) {
        throw new Error(`Media «${asset.name}» no tiene bytes íntegros; usá backup sin Media.`);
      }
      mediaFiles.set(asset.id, blob);
    }
  }

  return {
    projects,
    songs,
    presets: presets.filter((preset) => preset.id !== "preset-default"),
    mediaAssets,
    mediaCollections,
    bibleVersions,
    bibleBooks,
    bibleChapters,
    preferences: {
      mediaLibrary: parseMediaLibraryPreferences(
        options.storage.getItem(MEDIA_LIBRARY_PREFERENCES_KEY),
      ),
      liveLibrary: parseLibraryPreference(
        options.storage.getItem(LIBRARY_PREFERENCE_KEY),
        "desktop",
      ),
      liveDockHeight: parseLibraryDockPreference(
        options.storage.getItem(LIBRARY_DOCK_HEIGHT_KEY),
        240,
      ),
      liveBackgrounds: parseBackgroundPreferences(
        options.storage.getItem(BACKGROUND_PREFERENCES_KEY),
      ),
      activeProjectId:
        typeof activeProjectId === "string" &&
        projects.some((project) => project.id === activeProjectId)
          ? activeProjectId
          : null,
    },
    syncSummary: {
      hadActiveSyncLink:
        typeof activeSyncLinkKey === "string" &&
        links.some((link) => link.linkKey === activeSyncLinkKey && link.state === "active"),
      pendingSyncOperations: queue.filter((entry) => entry.state === "pending").length,
      conflictCount: conflicts.filter((conflict) => !conflict.archivedAt).length,
    },
    mediaFiles,
  };
}

export function snapshotFingerprint(snapshot: LocalBackupSnapshot): string {
  return JSON.stringify({
    media: snapshot.mediaAssets.map((asset) => [asset.id, asset.updatedAt, asset.sizeBytes]),
    collections: snapshot.mediaCollections.map((item) => [item.id, item.updatedAt]),
    bible: snapshot.bibleVersions,
    bibleBooks: snapshot.bibleBooks.length,
    bibleChapters: snapshot.bibleChapters.length,
  });
}
