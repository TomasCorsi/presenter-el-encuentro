import { BlobReader, ZipReader, type Entry, type FileEntry } from "@zip.js/zip.js";
import type { BackupInspection, BackupProgress } from "@/domain/backup/backup";
import { DEFAULT_PRESET_ID } from "@/domain/presets/preset";
import { parsePreset, parseProject, parseSong } from "@/services/local-data/application-migrations";
import { createUuid } from "@/utils/create-id";
import {
  APPLICATION_STORES,
  idbTransactionDone,
  openApplicationDatabase,
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
import { parseMediaAsset, parseMediaCollection } from "@/services/media/media-repository";
import type { MediaAsset } from "@/domain/media/media";
import type { MediaStorageGenerationManager } from "@/services/media/media-storage-generations";
import { hashingTransform } from "./backup-integrity";
import { readVerifiedBackup } from "./backup-inspector";
import {
  captureRestoreSnapshot,
  rollbackRestore,
  saveRestoreJournal,
  updateRestoreJournalPhase,
  type RestoreJournal,
} from "./backup-maintenance-database";
import { BACKUP_PREFERENCE_KEYS, restoreBackupPreferences } from "./backup-preferences";

function fileEntries(entries: Entry[]): Map<string, FileEntry> {
  return new Map(
    entries
      .filter((entry): entry is FileEntry => !entry.directory && "getData" in entry)
      .map((entry) => [entry.filename, entry]),
  );
}

function openNamed(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`No se pudo abrir ${name}.`));
  });
}

async function replaceDatabaseStores(
  database: IDBDatabase,
  values: Record<string, readonly unknown[]>,
): Promise<void> {
  const names = Object.keys(values);
  const transaction = database.transaction(names, "readwrite");
  const completed = idbTransactionDone(transaction);
  for (const name of names) {
    const store = transaction.objectStore(name);
    store.clear();
    for (const value of values[name] ?? []) store.put(value);
  }
  await completed;
}

export async function restoreLocalBackup(options: {
  inspection: BackupInspection;
  factory: IDBFactory;
  storage: Storage;
  mediaManager: MediaStorageGenerationManager;
  signal?: AbortSignal;
  onProgress?: (progress: BackupProgress) => void;
}): Promise<void> {
  const { file, manifest } = options.inspection;
  options.signal?.throwIfAborted();
  const payload = await readVerifiedBackup(file, options.signal);
  const projects = payload.projects.map((value) => {
    const parsed = parseProject(value, 2);
    if (!parsed) throw new Error("Projects contiene un registro inválido.");
    return parsed;
  });
  const songs = payload.songs.map((value) => {
    const parsed = parseSong(value);
    if (!parsed) throw new Error("Songs contiene un registro inválido.");
    return parsed;
  });
  const presets = payload.presets.map((value) => {
    const parsed = parsePreset(value);
    if (!parsed || parsed.id === DEFAULT_PRESET_ID)
      throw new Error("Presets contiene un registro inválido.");
    return parsed;
  });
  const mediaAssets = payload.mediaAssets.map((value) => {
    const parsed = parseMediaAsset(value);
    if (!parsed) throw new Error("Media contiene metadata inválida.");
    return parsed;
  });
  const mediaCollections = payload.mediaCollections.map((value) => {
    const parsed = parseMediaCollection(value);
    if (!parsed) throw new Error("Media contiene una colección inválida.");
    return parsed;
  });
  if (manifest.backupType === "complete" && options.mediaManager.open().kind !== "opfs") {
    if (mediaAssets.some((asset) => asset.kind === "video")) {
      throw new Error(
        "Restore de videos requiere OPFS; este navegador sólo ofrece IndexedDB Blob.",
      );
    }
  }

  const restoreId = createUuid();
  const newGeneration = `restore-${restoreId}`;
  const journal: RestoreJournal = {
    id: "active",
    restoreId,
    phase: "prepared",
    createdAt: new Date().toISOString(),
    newGeneration,
    snapshot: await captureRestoreSnapshot({
      factory: options.factory,
      storage: options.storage,
      preferenceKeys: BACKUP_PREFERENCE_KEYS,
      previousGeneration: options.mediaManager.activeGeneration(),
    }),
  };
  await saveRestoreJournal(options.factory, journal);
  const targetStorage = options.mediaManager.open(newGeneration);

  try {
    const zip = new ZipReader(new BlobReader(file), { checkSignature: true });
    try {
      const entries = fileEntries(await zip.getEntries());
      const mediaManifest = manifest.entries.filter((entry) => entry.type === "media");
      let completed = 0;
      for (const expected of mediaManifest) {
        options.signal?.throwIfAborted();
        const entry = entries.get(expected.path);
        if (!entry || !expected.mediaId || !expected.mimeType)
          throw new Error("Falta Media declarada.");
        let digest: { sha256: string; bytes: number } | null = null;
        const bridge = new TransformStream<Uint8Array, Uint8Array>();
        const saving = targetStorage.saveStream(
          expected.mediaId,
          bridge.readable.pipeThrough(hashingTransform((value) => (digest = value))),
          expected.mimeType,
        );
        await Promise.all([entry.getData(bridge.writable, { checkSignature: true }), saving]);
        const result = digest as { sha256: string; bytes: number } | null;
        if (
          !result ||
          result.bytes !== expected.uncompressedSize ||
          result.sha256 !== expected.sha256
        ) {
          throw new Error(`Checksum inválido al guardar ${expected.path}.`);
        }
        completed += 1;
        options.onProgress?.({
          phase: "stage",
          completedBytes: completed,
          totalBytes: mediaManifest.length,
          completedItems: completed,
          totalItems: mediaManifest.length,
          message: `Preparando Media ${completed}/${mediaManifest.length}…`,
        });
      }
    } finally {
      await zip.close();
    }
    await updateRestoreJournalPhase(options.factory, "staged");
    options.signal?.throwIfAborted();
    await updateRestoreJournalPhase(options.factory, "committing");

    const app = await openApplicationDatabase(options.factory);
    const now = new Date().toISOString();
    await replaceDatabaseStores(app, {
      [APPLICATION_STORES.projects]: projects,
      [APPLICATION_STORES.songs]: songs,
      [APPLICATION_STORES.presets]: presets,
      [APPLICATION_STORES.meta]: [
        {
          key: "activeProjectId",
          value: projects.some((item) => item.id === payload.preferences.activeProjectId)
            ? payload.preferences.activeProjectId
            : null,
        },
        ...(["projects", "songs", "presets"] as const).map((domain) => ({
          key: `migration.${domain}.local-storage-v${domain === "projects" ? "2" : "1"}`,
          value: {
            completedAt: now,
            source: "backup-restore",
            count: { projects, songs, presets }[domain].length,
          },
        })),
        { key: "sync.reassessment-required", value: { requiredAt: now, reason: "backup-restore" } },
      ],
      [APPLICATION_STORES.syncLinks]: [],
      [APPLICATION_STORES.syncEntities]: [],
      [APPLICATION_STORES.syncQueue]: [],
      [APPLICATION_STORES.syncConflicts]: [],
    });

    const bible = await openNamed(options.factory, BIBLE_DB_NAME);
    await replaceDatabaseStores(bible, {
      [BIBLE_VERSIONS_STORE]: payload.bibleVersions,
      [BIBLE_BOOKS_STORE]: payload.bibleBooks,
      [BIBLE_CHAPTERS_STORE]: payload.bibleChapters,
    });
    bible.close();
    const normalizedAssets: MediaAsset[] = mediaAssets.map((asset) => ({
      ...asset,
      storage: targetStorage.kind,
    }));
    const media = await openNamed(options.factory, MEDIA_DB_NAME);
    await replaceDatabaseStores(media, {
      [MEDIA_ASSETS_STORE]: normalizedAssets,
      [MEDIA_COLLECTIONS_STORE]: mediaCollections,
    });
    media.close();
    restoreBackupPreferences({
      storage: options.storage,
      preferences: payload.preferences,
      mediaIds: normalizedAssets.map((asset) => asset.id),
      bibleVersionIds: payload.bibleVersions.flatMap((value) =>
        value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
          ? [(value as { id: string }).id]
          : [],
      ),
    });
    options.mediaManager.activate(newGeneration);
    await updateRestoreJournalPhase(options.factory, "committed");
  } catch (error) {
    await rollbackRestore({
      factory: options.factory,
      storage: options.storage,
      mediaManager: options.mediaManager,
      journal: { ...journal, phase: "committing" },
    });
    throw error;
  }
}
