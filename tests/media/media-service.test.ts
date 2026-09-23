import { describe, expect, it } from "bun:test";

import { findMediaUsage } from "@/domain/media/media-rules";
import type { Project } from "@/domain/projects/project";
import { MediaInUseError, MediaService } from "@/features/media/media-service";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";

function makeService(projects: Project[] = []) {
  const repository = createInMemoryMediaRepository();
  const storage = createInMemoryMediaStorage();
  const service = new MediaService(repository, storage, { list: async () => projects });
  return { repository, storage, service };
}

function projectUsing(mediaId: string): Project {
  return {
    id: "p1",
    name: "Domingo",
    rundown: [
      { id: "i1", type: "media", sourceId: mediaId, title: "Media", order: 0 },
    ],
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
