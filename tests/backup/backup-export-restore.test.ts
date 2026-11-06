import { describe, expect, it } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { BACKUP_MIME } from "@/domain/backup/backup";
import { exportLocalBackup } from "@/services/backup/backup-exporter";
import { inspectLocalBackup, readVerifiedBackup } from "@/services/backup/backup-inspector";
import { restoreLocalBackup } from "@/services/backup/backup-restorer";
import {
  recoverInterruptedRestore,
  readRestoreJournal,
  updateRestoreJournalPhase,
} from "@/services/backup/backup-maintenance-database";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";
import { createIndexedDbMediaRepository } from "@/services/media/indexeddb-media-repository";
import { createIndexedDbBibleRepository } from "@/services/bible/indexeddb-bible-repository";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import type { MediaStorageGenerationManager } from "@/services/media/media-storage-generations";
import type { MediaFileStorage } from "@/services/media/media-file-storage";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  get length() {
    return this.#values.size;
  }
  clear() {
    this.#values.clear();
  }
  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#values.delete(key);
  }
  setItem(key: string, value: string) {
    this.#values.set(key, value);
  }
}

async function initialize(factory: IDBFactory) {
  await openApplicationDatabase(factory);
  await createIndexedDbMediaRepository(factory).list();
  await createIndexedDbBibleRepository(factory).listVersions();
}

async function putProject(factory: IDBFactory, id: string) {
  const db = await openApplicationDatabase(factory);
  const tx = db.transaction(APPLICATION_STORES.projects, "readwrite");
  const completed = idbTransactionDone(tx);
  tx.objectStore(APPLICATION_STORES.projects).put({
    id,
    workspaceId: "local-workspace",
    name: `Project ${id}`,
    rundown: [],
    createdAt: "2026-11-05T00:00:00.000Z",
    updatedAt: "2026-11-05T00:00:00.000Z",
  });
  await completed;
}

function generationManager(): MediaStorageGenerationManager {
  let active = "legacy";
  const generations = new Map<string, MediaFileStorage>();
  return {
    activeGeneration: () => active,
    open: (generation = active) => {
      let storage = generations.get(generation);
      if (!storage) {
        storage = createInMemoryMediaStorage();
        generations.set(generation, storage);
      }
      return storage;
    },
    activate: (generation) => {
      active = generation;
    },
    deleteGeneration: async (generation) => {
      generations.delete(generation);
    },
  };
}

async function makeBackup(
  factory: IDBFactory,
  storage: Storage,
  options: { type?: "complete" | "without-media"; mediaStorage?: MediaFileStorage } = {},
): Promise<File> {
  const blob = await exportLocalBackup({
    type: options.type ?? "without-media",
    factory,
    storage,
    mediaStorage: options.mediaStorage ?? createInMemoryMediaStorage(),
    appVersion: "Fase 15",
    buildId: "test",
  });
  if (!blob) throw new Error("El test esperaba un Blob.");
  return new File([blob], "test.presenterbackup", { type: BACKUP_MIME });
}

describe("backup export and replace-only restore", () => {
  it("exports a verified archive without Sync internals", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    await initialize(factory);
    await putProject(factory, "source");
    const payload = await readVerifiedBackup(await makeBackup(factory, storage));
    expect(payload.manifest.backupType).toBe("without-media");
    expect(payload.projects).toHaveLength(1);
    expect(payload.manifest.source.syncStateExcluded).toBe(true);
    expect(payload.manifest.entries.some((entry) => entry.path.includes("sync"))).toBe(false);
  });

  it("aborts a complete export when Media bytes are missing", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    await initialize(factory);
    await createIndexedDbMediaRepository(factory).put({
      id: "missing",
      workspaceId: "local-media",
      name: "Missing",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 10,
      storage: "memory",
      tags: [],
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
      presentationUpdatedAt: "2026-11-05T00:00:00.000Z",
    });
    await expect(
      exportLocalBackup({
        type: "complete",
        factory,
        storage,
        mediaStorage: createInMemoryMediaStorage(),
        appVersion: "Fase 15",
        buildId: "test",
      }),
    ).rejects.toThrow("no tiene bytes");
  });

  it("streams a complete archive with Media and rejects truncation", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    const mediaStorage = createInMemoryMediaStorage();
    await initialize(factory);
    await createIndexedDbMediaRepository(factory).put({
      id: "image",
      workspaceId: "local-media",
      name: "Image",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 4,
      storage: "memory",
      tags: [],
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
      presentationUpdatedAt: "2026-11-05T00:00:00.000Z",
    });
    await mediaStorage.save(
      "image",
      new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
    );
    const file = await makeBackup(factory, storage, { type: "complete", mediaStorage });
    const payload = await readVerifiedBackup(file);
    expect(payload.manifest.counts.mediaFiles).toBe(1);
    expect(
      payload.manifest.entries.find((entry) => entry.mediaId === "image")?.uncompressedSize,
    ).toBe(4);
    const truncated = new File([file.slice(0, file.size - 16)], "truncated.presenterbackup", {
      type: BACKUP_MIME,
    });
    await expect(readVerifiedBackup(truncated)).rejects.toThrow();
  });

  it("replaces existing data, clears Sync, switches generation and finalizes recovery", async () => {
    const sourceFactory = new IDBFactory();
    const sourceStorage = new MemoryStorage();
    await initialize(sourceFactory);
    await putProject(sourceFactory, "source");
    const file = await makeBackup(sourceFactory, sourceStorage);

    const targetFactory = new IDBFactory();
    const targetStorage = new MemoryStorage();
    await initialize(targetFactory);
    await putProject(targetFactory, "old");
    const mediaStorage = createInMemoryMediaStorage();
    const inspection = await inspectLocalBackup({
      file,
      factory: targetFactory,
      storage: targetStorage,
      mediaStorage,
    });
    const manager = generationManager();
    await restoreLocalBackup({
      inspection,
      factory: targetFactory,
      storage: targetStorage,
      mediaManager: manager,
    });

    const db = await openApplicationDatabase(targetFactory);
    const projects = await idbRequest<Array<{ id: string }>>(
      db.transaction(APPLICATION_STORES.projects).objectStore(APPLICATION_STORES.projects).getAll(),
    );
    const queue = await idbRequest<unknown[]>(
      db
        .transaction(APPLICATION_STORES.syncQueue)
        .objectStore(APPLICATION_STORES.syncQueue)
        .getAll(),
    );
    expect(projects.map((project) => project.id)).toEqual(["source"]);
    expect(queue).toEqual([]);
    expect(manager.activeGeneration()).toStartWith("restore-");
    expect((await readRestoreJournal(targetFactory))?.phase).toBe("committed");
    await recoverInterruptedRestore({
      factory: targetFactory,
      storage: targetStorage,
      mediaManager: manager,
    });
    expect(await readRestoreJournal(targetFactory)).toBeNull();
  });

  it("rolls an interrupted commit back to the old data and generation", async () => {
    const sourceFactory = new IDBFactory();
    const sourceStorage = new MemoryStorage();
    await initialize(sourceFactory);
    await putProject(sourceFactory, "source");
    const file = await makeBackup(sourceFactory, sourceStorage);
    const targetFactory = new IDBFactory();
    const targetStorage = new MemoryStorage();
    await initialize(targetFactory);
    await putProject(targetFactory, "old");
    const inspection = await inspectLocalBackup({
      file,
      factory: targetFactory,
      storage: targetStorage,
      mediaStorage: createInMemoryMediaStorage(),
    });
    const manager = generationManager();
    await restoreLocalBackup({
      inspection,
      factory: targetFactory,
      storage: targetStorage,
      mediaManager: manager,
    });
    await updateRestoreJournalPhase(targetFactory, "committing");
    await recoverInterruptedRestore({
      factory: targetFactory,
      storage: targetStorage,
      mediaManager: manager,
    });
    const db = await openApplicationDatabase(targetFactory);
    const projects = await idbRequest<Array<{ id: string }>>(
      db.transaction(APPLICATION_STORES.projects).objectStore(APPLICATION_STORES.projects).getAll(),
    );
    expect(projects.map((project) => project.id)).toEqual(["old"]);
    expect(manager.activeGeneration()).toBe("legacy");
    expect(await readRestoreJournal(targetFactory)).toBeNull();
  });
});
