import { describe, expect, it } from "bun:test";

import type { MediaAsset } from "@/domain/media/media";
import {
  findMediaUsage,
  formatMediaSize,
  mediaKindForMime,
  searchMedia,
  validateMediaFile,
} from "@/domain/media/media-rules";
import type { Project } from "@/domain/projects/project";

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "m1",
    workspaceId: "local-media",
    name: "Fondo montañas",
    kind: "image",
    mimeType: "image/png",
    sizeBytes: 2048,
    storage: "opfs",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function projectWithMedia(name: string, mediaId: string, times = 1): Project {
  return {
    id: `p-${name}`,
    name,
    rundown: Array.from({ length: times }, (_, index) => ({
      id: `i${index}`,
      type: "media" as const,
      sourceId: mediaId,
      title: "Media",
      order: index,
    })),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Project;
}

describe("mediaKindForMime", () => {
  it("acepta PNG, JPEG, WEBP, MP4 y WEBM", () => {
    expect(mediaKindForMime("image/png")).toBe("image");
    expect(mediaKindForMime("image/jpeg")).toBe("image");
    expect(mediaKindForMime("image/webp")).toBe("image");
    expect(mediaKindForMime("video/mp4")).toBe("video");
    expect(mediaKindForMime("video/webm")).toBe("video");
  });

  it("rechaza GIF y cualquier otro formato (Fase 10 lo excluye)", () => {
    expect(mediaKindForMime("image/gif")).toBeNull();
    expect(mediaKindForMime("application/pdf")).toBeNull();
    expect(mediaKindForMime("audio/mpeg")).toBeNull();
  });
});

describe("validateMediaFile", () => {
  it("null cuando el archivo es importable", () => {
    expect(validateMediaFile({ name: "a.png", mimeType: "image/png", sizeBytes: 10 })).toBeNull();
  });

  it("mensaje claro para formato no soportado", () => {
    expect(validateMediaFile({ name: "a.gif", mimeType: "image/gif", sizeBytes: 10 })).toContain(
      "no es un formato soportado",
    );
  });

  it("mensaje claro para archivo vacío", () => {
    expect(validateMediaFile({ name: "a.png", mimeType: "image/png", sizeBytes: 0 })).toContain(
      "vacío",
    );
  });
});

describe("searchMedia", () => {
  const assets = [asset({ id: "1", name: "Montañas" }), asset({ id: "2", name: "Río" })];

  it("sin query devuelve todo ordenado por nombre", () => {
    expect(searchMedia(assets, "").map((a) => a.name)).toEqual(["Montañas", "Río"]);
  });

  it("tolera acentos y mayúsculas", () => {
    expect(searchMedia(assets, "montanas").map((a) => a.id)).toEqual(["1"]);
    expect(searchMedia(assets, "RIO").map((a) => a.id)).toEqual(["2"]);
  });
});

describe("findMediaUsage", () => {
  it("cuenta apariciones y nombra los projects sin repetir", () => {
    const usage = findMediaUsage(
      [projectWithMedia("Domingo", "m1", 2), projectWithMedia("Vigilia", "m1")],
      "m1",
    );
    expect(usage.occurrences).toBe(3);
    expect(usage.projectNames).toEqual(["Domingo", "Vigilia"]);
  });

  it("sin referencias → cero", () => {
    expect(findMediaUsage([projectWithMedia("Domingo", "otro")], "m1").occurrences).toBe(0);
  });
});

describe("formatMediaSize", () => {
  it("formatea B, KB, MB y GB", () => {
    expect(formatMediaSize(512)).toBe("512 B");
    expect(formatMediaSize(2048)).toBe("2.0 KB");
    expect(formatMediaSize(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatMediaSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});
