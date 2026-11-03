import { describe, expect, it } from "bun:test";

import type { Project } from "@/domain/projects/project";
import {
  MediaBatchInUseError,
  MediaService,
} from "@/features/media/media-service";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";

const noInfo = async () => null;

function projectUsing(mediaId: string): Project {
  return {
    id: "p1",
    workspaceId: "local-workspace",
    name: "Domingo",
    rundown: [{ id: "i1", type: "media", sourceId: mediaId, title: "Media", order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeService(projects: Project[] = []) {
  const repository = createInMemoryMediaRepository();
  const storage = createInMemoryMediaStorage();
  let ids = 0;
  let tick = 0;
  const service = new MediaService(
    repository,
    storage,
    { list: async () => projects },
    "local-media",
    () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    () => `id-${ids++}`,
    noInfo,
  );
  return { repository, storage, service };
}

async function importImage(service: MediaService, name: string) {
  const result = await service.importFiles([
    new File([new Uint8Array([1])], `${name}.png`, { type: "image/png" }),
  ]);
  return result.imported[0]!;
}

describe("MediaService organization", () => {
  it("crea colecciones únicas y al eliminarlas desasigna sin borrar assets", async () => {
    const { service } = makeService();
    const collection = await service.createCollection(" Jóvenes ");
    await expect(service.createCollection("jovenes")).rejects.toThrow("Ya existe");
    const imported = await importImage(service, "Fondo");
    await service.moveToCollection([imported.id], collection.id);
    await service.deleteCollection(collection.id);
    expect((await service.get(imported.id))?.collectionId).toBeUndefined();
    expect(await service.listCollections()).toEqual([]);
  });

  it("colección y tags cambian updatedAt pero preservan presentationUpdatedAt", async () => {
    const { service } = makeService();
    const imported = await importImage(service, "Fondo");
    const presentationRevision = imported.presentationUpdatedAt;
    const [tagged] = await service.addTags([imported.id], [" Jóvenes ", "JOVENES", "azul"]);
    expect(tagged?.tags).toEqual(["jóvenes", "azul"]);
    expect(tagged?.updatedAt).not.toBe(imported.updatedAt);
    expect(tagged?.presentationUpdatedAt).toBe(presentationRevision);
    const renamed = await service.rename(imported.id, "Fondo nuevo");
    expect(renamed.presentationUpdatedAt).not.toBe(presentationRevision);
  });
});

describe("MediaService.deleteMany", () => {
  it("hace preflight all-or-nothing cuando cualquier asset está en uso", async () => {
    const repository = createInMemoryMediaRepository();
    const storage = createInMemoryMediaStorage();
    let id = 0;
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [projectUsing("id-0")] },
      "local-media",
      () => new Date("2026-01-01T00:00:00.000Z"),
      () => `id-${id++}`,
      noInfo,
    );
    const first = await importImage(service, "Uno");
    const second = await importImage(service, "Dos");
    await expect(service.deleteMany([first.id, second.id])).rejects.toBeInstanceOf(
      MediaBatchInUseError,
    );
    expect(await service.list()).toHaveLength(2);
    expect(storage.files.size).toBe(2);
  });

  it("reporta completados y fallidos después del preflight físico", async () => {
    const repository = createInMemoryMediaRepository();
    const base = createInMemoryMediaStorage();
    const storage = {
      ...base,
      async delete(id: string) {
        if (id === "id-1") throw new Error("disk failure");
        await base.delete(id);
      },
    };
    let id = 0;
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date("2026-01-01T00:00:00.000Z"),
      () => `id-${id++}`,
      noInfo,
    );
    const first = await importImage(service, "Uno");
    const second = await importImage(service, "Dos");
    const result = await service.deleteMany([first.id, second.id]);
    expect(result.completed.map((asset) => asset.id)).toEqual(["id-0"]);
    expect(result.failed).toEqual([
      { mediaId: "id-1", name: "Dos", message: "disk failure" },
    ]);
    expect(await service.get("id-0")).toBeNull();
    expect(await service.get("id-1")).not.toBeNull();
  });
});
