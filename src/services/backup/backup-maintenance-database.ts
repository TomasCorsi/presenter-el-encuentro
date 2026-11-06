import {
  APPLICATION_STORES,
  idbRequest,
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
import type { MediaStorageGenerationManager } from "@/services/media/media-storage-generations";

export const MAINTENANCE_DB_NAME = "broadcast-control.maintenance";
export const MAINTENANCE_DB_VERSION = 1;
const RESTORES_STORE = "restore_operations";
const ACTIVE_RESTORE_ID = "active";

export type RestoreJournalPhase = "prepared" | "staged" | "committing" | "committed";

export interface RestoreRollbackSnapshot {
  app: Record<string, unknown[]>;
  bible: { versions: unknown[]; books: unknown[]; chapters: unknown[] };
  media: { assets: unknown[]; collections: unknown[] };
  preferences: Record<string, string | null>;
  previousGeneration: string;
}

export interface RestoreJournal {
  id: typeof ACTIVE_RESTORE_ID;
  restoreId: string;
  phase: RestoreJournalPhase;
  createdAt: string;
  newGeneration: string;
  snapshot: RestoreRollbackSnapshot;
}

interface MaintenanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function openMaintenanceDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(MAINTENANCE_DB_NAME, MAINTENANCE_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RESTORES_STORE)) {
        request.result.createObjectStore(RESTORES_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir maintenance DB."));
  });
}

function openNamed(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`No se pudo abrir ${name}.`));
  });
}

async function all(db: IDBDatabase, store: string): Promise<unknown[]> {
  if (!db.objectStoreNames.contains(store)) return [];
  return idbRequest<unknown[]>(db.transaction(store).objectStore(store).getAll());
}

export async function captureRestoreSnapshot(options: {
  factory: IDBFactory;
  storage: Pick<Storage, "getItem">;
  preferenceKeys: readonly string[];
  previousGeneration: string;
}): Promise<RestoreRollbackSnapshot> {
  const appDb = await openApplicationDatabase(options.factory);
  const app: Record<string, unknown[]> = {};
  const names = Object.values(APPLICATION_STORES);
  const transaction = appDb.transaction(names);
  await Promise.all(
    names.map(async (name) => {
      app[name] = await idbRequest<unknown[]>(transaction.objectStore(name).getAll());
    }),
  );
  const bibleDb = await openNamed(options.factory, BIBLE_DB_NAME);
  const mediaDb = await openNamed(options.factory, MEDIA_DB_NAME);
  const snapshot: RestoreRollbackSnapshot = {
    app,
    bible: {
      versions: await all(bibleDb, BIBLE_VERSIONS_STORE),
      books: await all(bibleDb, BIBLE_BOOKS_STORE),
      chapters: await all(bibleDb, BIBLE_CHAPTERS_STORE),
    },
    media: {
      assets: await all(mediaDb, MEDIA_ASSETS_STORE),
      collections: await all(mediaDb, MEDIA_COLLECTIONS_STORE),
    },
    preferences: Object.fromEntries(
      options.preferenceKeys.map((key) => [key, options.storage.getItem(key)]),
    ),
    previousGeneration: options.previousGeneration,
  };
  bibleDb.close();
  mediaDb.close();
  return snapshot;
}

export async function saveRestoreJournal(factory: IDBFactory, journal: RestoreJournal) {
  const db = await openMaintenanceDatabase(factory);
  const transaction = db.transaction(RESTORES_STORE, "readwrite");
  const completed = idbTransactionDone(transaction);
  transaction.objectStore(RESTORES_STORE).put(journal);
  await completed;
  db.close();
}

export async function readRestoreJournal(factory: IDBFactory): Promise<RestoreJournal | null> {
  const db = await openMaintenanceDatabase(factory);
  const value = await idbRequest<RestoreJournal | undefined>(
    db.transaction(RESTORES_STORE).objectStore(RESTORES_STORE).get(ACTIVE_RESTORE_ID),
  );
  db.close();
  return value ?? null;
}

export async function updateRestoreJournalPhase(
  factory: IDBFactory,
  phase: RestoreJournalPhase,
): Promise<void> {
  const journal = await readRestoreJournal(factory);
  if (!journal) throw new Error("No existe journal de restore activo.");
  await saveRestoreJournal(factory, { ...journal, phase });
}

export async function clearRestoreJournal(factory: IDBFactory): Promise<void> {
  const db = await openMaintenanceDatabase(factory);
  const transaction = db.transaction(RESTORES_STORE, "readwrite");
  const completed = idbTransactionDone(transaction);
  transaction.objectStore(RESTORES_STORE).delete(ACTIVE_RESTORE_ID);
  await completed;
  db.close();
}

async function replaceStores(db: IDBDatabase, values: Record<string, unknown[]>): Promise<void> {
  const names = Object.keys(values).filter((name) => db.objectStoreNames.contains(name));
  if (!names.length) return;
  const transaction = db.transaction(names, "readwrite");
  const completed = idbTransactionDone(transaction);
  for (const name of names) {
    const store = transaction.objectStore(name);
    store.clear();
    for (const value of values[name] ?? []) store.put(value);
  }
  await completed;
}

export async function rollbackRestore(options: {
  factory: IDBFactory;
  storage: MaintenanceStorage;
  mediaManager: MediaStorageGenerationManager;
  journal: RestoreJournal;
}): Promise<void> {
  const { snapshot } = options.journal;
  const app = await openApplicationDatabase(options.factory);
  await replaceStores(app, snapshot.app);
  const bible = await openNamed(options.factory, BIBLE_DB_NAME);
  await replaceStores(bible, {
    [BIBLE_VERSIONS_STORE]: snapshot.bible.versions,
    [BIBLE_BOOKS_STORE]: snapshot.bible.books,
    [BIBLE_CHAPTERS_STORE]: snapshot.bible.chapters,
  });
  bible.close();
  const media = await openNamed(options.factory, MEDIA_DB_NAME);
  await replaceStores(media, {
    [MEDIA_ASSETS_STORE]: snapshot.media.assets,
    [MEDIA_COLLECTIONS_STORE]: snapshot.media.collections,
  });
  media.close();
  for (const [key, value] of Object.entries(snapshot.preferences)) {
    if (value === null) options.storage.removeItem?.(key);
    else options.storage.setItem(key, value);
  }
  options.mediaManager.activate(snapshot.previousGeneration);
  await options.mediaManager.deleteGeneration(options.journal.newGeneration).catch(() => undefined);
  await clearRestoreJournal(options.factory);
}

export async function recoverInterruptedRestore(options: {
  factory: IDBFactory;
  storage: MaintenanceStorage;
  mediaManager: MediaStorageGenerationManager;
}): Promise<void> {
  const journal = await readRestoreJournal(options.factory);
  if (!journal) return;
  if (journal.phase !== "committed") {
    await rollbackRestore({ ...options, journal });
    return;
  }
  if (journal.snapshot.previousGeneration !== "legacy") {
    await options.mediaManager
      .deleteGeneration(journal.snapshot.previousGeneration)
      .catch(() => undefined);
  } else {
    const legacy = options.mediaManager.open("legacy");
    for (const value of journal.snapshot.media.assets) {
      const id = value && typeof value === "object" ? (value as { id?: unknown }).id : null;
      if (typeof id === "string") await legacy.delete(id).catch(() => undefined);
    }
  }
  await clearRestoreJournal(options.factory);
}
