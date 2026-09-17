import { describe, expect, test } from "bun:test";

import {
  LEGACY_STORAGE_KEY_V1,
  STORAGE_KEY,
  createLocalStorageProjectRepository,
  type KeyValueStorage,
} from "@/services/projects/local-storage-project-repository";

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const legacyPayload = JSON.stringify({
  version: 1,
  projects: [
    {
      id: "project-1", workspaceId: "local-workspace", name: "Domingo", itemIds: ["ignorado"],
      createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T10:00:00.000Z",
    },
  ],
  activeProjectId: "project-1",
});

describe("project repository migration v1 → v2", () => {
  test("migrates legacy projects adding an empty rundown and dropping itemIds", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY_V1, legacyPayload);

    const repository = createLocalStorageProjectRepository(storage);
    const projects = await repository.list();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual({
      id: "project-1", workspaceId: "local-workspace", name: "Domingo", rundown: [],
      createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T10:00:00.000Z",
    });
    expect(projects[0]).not.toHaveProperty("itemIds");
    expect(await repository.getActiveProjectId()).toBe("project-1");
  });

  test("keeps the v1 key as a backup and writes v2", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY_V1, legacyPayload);
    await createLocalStorageProjectRepository(storage).list();

    expect(storage.getItem(LEGACY_STORAGE_KEY_V1)).toBe(legacyPayload);
    expect(storage.getItem(STORAGE_KEY)).toContain("\"version\":2");
  });

  test("reads v2 without migrating again", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY_V1, legacyPayload);
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, projects: [], activeProjectId: null }));

    expect(await createLocalStorageProjectRepository(storage).list()).toEqual([]);
  });

  test("repairs an invalid rundown without losing the project", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      projects: [{
        id: "project-1", workspaceId: "local-workspace", name: "Domingo", rundown: "roto",
        createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z",
      }],
      activeProjectId: null,
    }));

    expect((await createLocalStorageProjectRepository(storage).list())[0]?.rundown).toEqual([]);
  });

  test("drops invalid rundown items and renormalizes the valid ones", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      projects: [{
        id: "project-1", workspaceId: "local-workspace", name: "Domingo",
        rundown: [
          { id: "item-2", type: "song", sourceId: "song-b", title: "B", order: 7 },
          { id: "roto", type: "unknown", sourceId: 5 },
          { id: "item-1", type: "song", sourceId: "song-a", title: "A", order: 3 },
        ],
        createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z",
      }],
      activeProjectId: null,
    }));

    const rundown = (await createLocalStorageProjectRepository(storage).list())[0]?.rundown ?? [];
    expect(rundown.map((item) => [item.id, item.order])).toEqual([["item-1", 0], ["item-2", 1]]);
  });

  test("falls back to an empty state on corrupt data", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "not-json");
    storage.setItem(LEGACY_STORAGE_KEY_V1, "not-json");

    const repository = createLocalStorageProjectRepository(storage);
    expect(await repository.list()).toEqual([]);
    expect(await repository.getActiveProjectId()).toBeNull();
  });

  test("persists a full rundown across repository instances", async () => {
    const storage = new MemoryStorage();
    const first = createLocalStorageProjectRepository(storage);
    await first.create({
      id: "project-1", workspaceId: "local-workspace", name: "Domingo",
      rundown: [{ id: "item-1", type: "song", sourceId: "song-a", title: "A", order: 0 }],
      createdAt: "2026-09-17T00:00:00.000Z", updatedAt: "2026-09-17T00:00:00.000Z",
    });

    const reloaded = await createLocalStorageProjectRepository(storage).get("project-1");
    expect(reloaded?.rundown).toEqual([
      { id: "item-1", type: "song", sourceId: "song-a", title: "A", order: 0 },
    ]);
  });
});
