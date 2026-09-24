import { describe, expect, it } from "bun:test";

import { findMediaUsage } from "@/domain/media/media-rules";
import type { Project } from "@/domain/projects/project";
import { MediaInUseError, MediaService } from "@/features/media/media-service";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";
import type { MediaRepository } from "@/services/media/media-repository";

const noInfo = async () => null;

function makeService(projects: Project[] = []) {
  const repository = createInMemoryMediaRepository();
  const storage = createInMemoryMediaStorage();
  const service = new MediaService(
    repository,
    storage,
    { list: async () => projects },
    "local-media",
    () => new Date(),
    () => crypto.randomUUID(),
    noInfo,
  );
  return { repository, storage, service };
}

function projectUsing(mediaId: string): Project {
  return {
    id: "p1",
    name: "Domingo",
    rundown: [{ id: "i1", type: "media", sourceId: mediaId, title: "Media", order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Project;
}

describe("MediaService.importFiles", () => {
  it("importa una imagen: bytes y metadata, lista al final", async () => {
    const { service } = makeService();
    const file = new File([new Uint8Array([1, 2, 3])], "Fondo.png", { type: "image/png" });
    const result = await service.importFiles([file]);
    expect(result.errors).toEqual([]);
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]!.name).toBe("Fondo");
    expect(result.imported[0]!.kind).toBe("image");
    expect((await service.list()).map((a) => a.id)).toEqual([result.imported[0]!.id]);
  });

  it("rechaza un GIF con mensaje claro y no deja rastro", async () => {
    const { service, storage } = makeService();
    const file = new File([new Uint8Array([1])], "anim.gif", { type: "image/gif" });
    const result = await service.importFiles([file]);
    expect(result.imported).toEqual([]);
    expect(result.errors[0]).toContain("no es un formato soportado");
    expect(await service.list()).toEqual([]);
    expect(storage.files.size).toBe(0);
  });

  it("sin OPFS rechaza los videos y acepta las imágenes", async () => {
    const { service } = makeService();
    expect(service.canImport({ mimeType: "video/mp4" })).toBe(false);
    expect(service.canImport({ mimeType: "image/png" })).toBe(true);

    const video = new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" });
    const result = await service.importFiles([video]);
    expect(result.imported).toEqual([]);
    expect(result.errors[0]).toContain("OPFS");
  });

  it("no espera persistent storage para continuar la importación", async () => {
    const repository = createInMemoryMediaRepository();
    const storage = createInMemoryMediaStorage();
    let preparationCalls = 0;
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date(),
      () => "asset-1",
      noInfo,
      async () => {
        preparationCalls += 1;
        await new Promise(() => undefined);
      },
    );
    const result = await service.importFiles([
      new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" }),
    ]);
    expect(preparationCalls).toBe(1);
    expect(result.imported).toHaveLength(1);
  });

  it("compensa los bytes si falla la escritura de metadata", async () => {
    const storage = createInMemoryMediaStorage();
    const repository: MediaRepository = {
      list: async () => [],
      get: async () => null,
      put: async () => {
        throw new Error("metadata failed");
      },
      delete: async () => undefined,
    };
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date(),
      () => "asset-1",
      noInfo,
    );
    const result = await service.importFiles([
      new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" }),
    ]);
    expect(result.imported).toEqual([]);
    expect(result.errors[0]).toContain("No se pudo registrar");
    expect(storage.files.size).toBe(0);
  });

  it("un fallo de bytes no escribe metadata", async () => {
    const repository = createInMemoryMediaRepository();
    const base = createInMemoryMediaStorage();
    const storage = {
      ...base,
      save: async () => {
        throw new Error("disk full");
      },
    };
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date(),
      () => "asset-1",
      noInfo,
    );
    const result = await service.importFiles([
      new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" }),
    ]);
    expect(result.imported).toEqual([]);
    expect(repository.assets.size).toBe(0);
  });

  it("rechaza y limpia un video cuyo códec no puede leerse", async () => {
    const repository = createInMemoryMediaRepository();
    const base = createInMemoryMediaStorage();
    const storage = { ...base, kind: "opfs" as const };
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date(),
      () => "video-1",
      noInfo,
    );
    const result = await service.importFiles([
      new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" }),
    ]);
    expect(result.imported).toEqual([]);
    expect(result.errors[0]).toContain("códec");
    expect(storage.files.size).toBe(0);
    expect(repository.assets.size).toBe(0);
  });

  it("acepta MP4 cuando el navegador puede leer su metadata", async () => {
    const repository = createInMemoryMediaRepository();
    const base = createInMemoryMediaStorage();
    const storage = { ...base, kind: "opfs" as const };
    const service = new MediaService(
      repository,
      storage,
      { list: async () => [] },
      "local-media",
      () => new Date(),
      () => "video-1",
      async () => ({ width: 1920, height: 1080, durationSeconds: 12 }),
    );
    const result = await service.importFiles([
      new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.imported[0]).toMatchObject({
      id: "video-1",
      kind: "video",
      width: 1920,
      height: 1080,
      durationSeconds: 12,
    });
  });
});

describe("MediaService.delete", () => {
  it("bloquea la eliminación de un asset en uso por Projects", async () => {
    const { service } = makeService();
    const file = new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" });
    const [imported] = (await service.importFiles([file])).imported;

    // Reconfiguramos el servicio con un project que lo usa.
    const inUse = new MediaService(
      createInMemoryMediaRepository(),
      createInMemoryMediaStorage(),
      { list: async () => [projectUsing(imported!.id)] },
      "local-media",
      () => new Date(),
      () => crypto.randomUUID(),
      noInfo,
    );
    // El repositorio del servicio "inUse" es otro, pero la regla de uso se
    // evalúa antes de tocar nada: basta verificar el bloqueo.
    await expect(inUse.delete(imported!.id)).rejects.toBeInstanceOf(MediaInUseError);
    expect(findMediaUsage([projectUsing(imported!.id)], imported!.id).occurrences).toBe(1);
  });

  it("sin uso elimina bytes y metadata", async () => {
    const { service, storage } = makeService();
    const file = new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" });
    const [imported] = (await service.importFiles([file])).imported;
    await service.delete(imported!.id);
    expect(await service.list()).toEqual([]);
    expect(storage.files.size).toBe(0);
  });
});

describe("MediaService.rename", () => {
  it("renombra y rechaza nombres vacíos", async () => {
    const { service } = makeService();
    const file = new File([new Uint8Array([1])], "Fondo.png", { type: "image/png" });
    const [imported] = (await service.importFiles([file])).imported;
    const renamed = await service.rename(imported!.id, "  Fondo principal  ");
    expect(renamed.name).toBe("Fondo principal");
    await expect(service.rename(imported!.id, "   ")).rejects.toThrow("vacío");
  });
});
