import { describe, expect, it } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import {
  APPLICATION_DB_NAME,
  APPLICATION_STORES,
  closeApplicationDatabase,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import { LocalDataChangeBus } from "@/services/local-data/local-data-change-bus";
import { SyncLocalStore } from "@/services/sync/sync-local-store";
import { ACTIVE_SYNC_LINK_META_KEY } from "@/services/sync/sync-journal";
import { createIndexedDbSongRepository } from "@/services/songs/indexeddb-song-repository";
import {
  createLinkKey,
  type SyncCloudRow,
  type SyncLinkAssessment,
  type SyncQueueEntry,
} from "@/domain/sync/sync";
import type { Song } from "@/domain/songs/song";

const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const linkKey = createLinkKey(userId, workspaceId);
const song = (title = "Song"): Song => ({
  id: "song-1",
  workspaceId: "local-workspace",
  title,
  sections: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const cloudSong = (
  title = "Song",
  changeSeq = 1,
  deletedAt: string | null = null,
): SyncCloudRow => ({
  entityType: "song",
  entityId: "song-1",
  record: song(title),
  revision: changeSeq,
  changeSeq,
  operationId: null,
  deletedAt,
});
const emptyAssessment = (): SyncLinkAssessment => ({
  userId,
  cloudWorkspaceId: workspaceId,
  linkKey,
  token: "token",
  counts: {
    project: {
      local: 0,
      cloud: 0,
      onlyLocal: 0,
      onlyCloud: 0,
      identical: 0,
      collisions: 0,
      tombstones: 0,
    },
    song: {
      local: 0,
      cloud: 0,
      onlyLocal: 0,
      onlyCloud: 0,
      identical: 0,
      collisions: 0,
      tombstones: 0,
    },
    preset: {
      local: 0,
      cloud: 0,
      onlyLocal: 0,
      onlyCloud: 0,
      identical: 0,
      collisions: 0,
      tombstones: 0,
    },
  },
  local: { project: [], song: [], preset: [] },
  cloud: { project: [], song: [], preset: [] },
  collisions: [],
});

async function queue(factory: IDBFactory): Promise<SyncQueueEntry[]> {
  const db = await openApplicationDatabase(factory);
  return idbRequest(
    db.transaction(APPLICATION_STORES.syncQueue).objectStore(APPLICATION_STORES.syncQueue).getAll(),
  );
}

describe("IndexedDB v2 sync", () => {
  it("upgrades v1 additively and preserves entities and activeProjectId", async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const request = factory.open(APPLICATION_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result
          .createObjectStore("projects", { keyPath: "id" })
          .put({ id: "p1", name: "Saved" });
        request.result.createObjectStore("songs", { keyPath: "id" });
        request.result.createObjectStore("presets", { keyPath: "id" });
        request.result
          .createObjectStore("meta", { keyPath: "key" })
          .put({ key: "activeProjectId", value: "p1" });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const db = await openApplicationDatabase(factory);
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([
        "projects",
        "songs",
        "presets",
        "meta",
        "sync_links",
        "sync_entities",
        "sync_queue",
        "sync_conflicts",
      ]),
    );
    expect(await idbRequest(db.transaction("projects").objectStore("projects").get("p1"))).toEqual({
      id: "p1",
      name: "Saved",
    });
    expect(
      await idbRequest(db.transaction("meta").objectStore("meta").get("activeProjectId")),
    ).toEqual({ key: "activeProjectId", value: "p1" });
  });

  it("journals atomically, coalesces and removes a never-synced create+delete", async () => {
    const factory = new IDBFactory();
    const bus = new LocalDataChangeBus(() => {
      throw new Error("disabled");
    });
    const local = new SyncLocalStore(factory, bus, () => "2026-01-01T00:00:00.000Z");
    await local.confirmLink(emptyAssessment());
    const repository = createIndexedDbSongRepository(factory, bus);
    await repository.create(song());
    const first = (await queue(factory))[0]!;
    expect(first.operation).toBe("upsert");
    expect(first.generation).toBe(1);
    await repository.update(song("Updated"));
    const second = (await queue(factory))[0]!;
    expect(second.operationId).toBe(first.operationId);
    expect(second.generation).toBe(2);
    expect((second.payload as Song).title).toBe("Updated");
    await closeApplicationDatabase(factory);
    expect(await queue(factory)).toEqual([second]);
    await repository.delete("song-1");
    expect(await queue(factory)).toHaveLength(0);
    await closeApplicationDatabase(factory);
  });

  it("aborts the entity write when its journal entry cannot be recorded", async () => {
    const factory = new IDBFactory();
    const database = await openApplicationDatabase(factory);
    const transaction = database.transaction(
      [APPLICATION_STORES.meta, APPLICATION_STORES.syncLinks],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    transaction.objectStore(APPLICATION_STORES.meta).put({
      key: ACTIVE_SYNC_LINK_META_KEY,
      value: "broken-link",
    });
    transaction.objectStore(APPLICATION_STORES.syncLinks).put({
      key: "broken-link",
      state: "active",
    });
    await completed;

    const repository = createIndexedDbSongRepository(factory);
    await expect(repository.create(song())).rejects.toBeDefined();
    expect(await repository.get("song-1")).toBeNull();
    expect(await queue(factory)).toHaveLength(0);
  });

  it("keeps a newer generation after an older response and advances its base revision", async () => {
    const factory = new IDBFactory();
    let now = "2099-01-01T00:00:00.000Z";
    const bus = new LocalDataChangeBus(() => {
      throw new Error("disabled");
    });
    const local = new SyncLocalStore(factory, bus, () => now);
    await local.confirmLink(emptyAssessment());
    const repository = createIndexedDbSongRepository(factory, bus);
    await repository.create(song());
    const claimed = await local.claimNext(linkKey, "tab-a", 1_000);
    expect(claimed?.leaseOwner).toBe("tab-a");
    await repository.update(song("Changed in flight"));
    await local.completePush(claimed!, {
      entityType: "song",
      entityId: "song-1",
      record: song(),
      revision: 1,
      changeSeq: 1,
      operationId: claimed!.operationId,
      deletedAt: null,
    });
    const retained = (await queue(factory))[0]!;
    expect(retained.generation).toBe(2);
    expect(retained.expectedCloudRevision).toBe(1);
    expect(retained.leaseOwner).toBeUndefined();
    now = new Date(Date.parse(now) + 2_000).toISOString();
    expect((await local.claimNext(linkKey, "tab-b"))?.leaseOwner).toBe("tab-b");
  });

  it("applies remote pages without enqueue and commits checkpoint with the entity", async () => {
    const factory = new IDBFactory();
    const bus = new LocalDataChangeBus(() => {
      throw new Error("disabled");
    });
    const local = new SyncLocalStore(factory, bus);
    await local.confirmLink(emptyAssessment());
    const link = (await local.getActiveLink())!;
    await local.applyPullPage(link, "song", [
      {
        entityType: "song",
        entityId: "remote",
        record: { ...song("Remote"), id: "remote", workspaceId },
        revision: 4,
        changeSeq: 12,
        operationId: null,
        deletedAt: null,
      },
    ]);
    expect((await createIndexedDbSongRepository(factory).get("remote"))?.workspaceId).toBe(
      "local-workspace",
    );
    expect(await queue(factory)).toHaveLength(0);
    expect((await local.getActiveLink())?.checkpoints.song).toBe(12);
  });

  it("classifies update/update, update/delete and delete/update conflicts", async () => {
    const cases = [
      { local: "update", remote: cloudSong("Cloud update", 2), kind: "update-update" },
      {
        local: "update",
        remote: cloudSong("Deleted", 2, "2026-01-02T00:00:00.000Z"),
        kind: "remote-delete-local",
      },
      { local: "delete", remote: cloudSong("Cloud update", 2), kind: "delete-update" },
    ] as const;

    for (const item of cases) {
      const factory = new IDBFactory();
      const bus = new LocalDataChangeBus(() => {
        throw new Error("disabled");
      });
      const local = new SyncLocalStore(factory, bus);
      const repository = createIndexedDbSongRepository(factory, bus);
      await repository.create(song());
      const assessment = emptyAssessment();
      assessment.local.song = [song()];
      assessment.cloud.song = [cloudSong()];
      await local.confirmLink(assessment);
      if (item.local === "update") await repository.update(song("Local update"));
      else await repository.delete("song-1");

      await local.applyPullPage((await local.getActiveLink())!, "song", [item.remote]);
      expect((await local.listConflicts(linkKey))[0]?.kind).toBe(item.kind);
      await closeApplicationDatabase(factory);
    }
  });

  it("detects initial collisions and supports all explicit resolutions", async () => {
    for (const resolution of ["keep-local", "use-cloud", "duplicate-local"] as const) {
      const factory = new IDBFactory();
      const bus = new LocalDataChangeBus(() => {
        throw new Error("disabled");
      });
      const local = new SyncLocalStore(factory, bus, () => "2026-01-03T00:00:00.000Z");
      const repository = createIndexedDbSongRepository(factory, bus);
      await repository.create(song("Local"));
      const assessment = emptyAssessment();
      assessment.local.song = [song("Local")];
      assessment.cloud.song = [cloudSong("Cloud", 2)];
      await local.confirmLink(assessment);
      const conflict = (await local.listConflicts(linkKey))[0]!;
      expect(conflict.kind).toBe("initial");

      await local.resolveConflict(conflict, resolution);
      expect(await local.listConflicts(linkKey)).toHaveLength(0);
      const songs = await repository.list();
      if (resolution === "keep-local") {
        expect(songs.map((item) => item.title)).toEqual(["Local"]);
        expect(await queue(factory)).toEqual([
          expect.objectContaining({ operation: "upsert", expectedCloudRevision: 2 }),
        ]);
      } else if (resolution === "use-cloud") {
        expect(songs.map((item) => item.title)).toEqual(["Cloud"]);
        expect(await queue(factory)).toHaveLength(0);
      } else {
        expect(songs.map((item) => item.title).sort()).toEqual(["Cloud", "Local (copia local)"]);
        expect(await queue(factory)).toEqual([
          expect.objectContaining({ operation: "upsert", expectedCloudRevision: null }),
        ]);
      }
      await closeApplicationDatabase(factory);
    }
  });

  it("archives link state on unlink instead of deleting it", async () => {
    const factory = new IDBFactory();
    const local = new SyncLocalStore(
      factory,
      new LocalDataChangeBus(() => {
        throw new Error("disabled");
      }),
    );
    await local.confirmLink(emptyAssessment());
    await local.archiveActiveLink();
    expect(await local.getActiveLink()).toBeNull();
    const db = await openApplicationDatabase(factory);
    const archived = await idbRequest<Array<{ state: string }>>(
      db
        .transaction(APPLICATION_STORES.syncLinks)
        .objectStore(APPLICATION_STORES.syncLinks)
        .index("by_link")
        .getAll(linkKey),
    );
    expect(archived).toContainEqual(expect.objectContaining({ state: "archived" }));
  });

  it("relinks the same identity through a fresh assessment without reviving archived queue", async () => {
    const factory = new IDBFactory();
    const bus = new LocalDataChangeBus(() => {
      throw new Error("disabled");
    });
    const local = new SyncLocalStore(factory, bus);
    await local.confirmLink(emptyAssessment());
    await createIndexedDbSongRepository(factory, bus).create(song());
    await local.archiveActiveLink();
    const assessment = emptyAssessment();
    assessment.local.song = [song("Current local")];
    await local.confirmLink(assessment);
    const entries = await queue(factory);
    expect(entries.filter((item) => item.state === "archived")).toHaveLength(1);
    expect(entries.filter((item) => item.state === "pending")).toHaveLength(1);
    expect(await local.getActiveLink()).toMatchObject({ linkKey, state: "active" });
  });
});
