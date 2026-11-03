import { describe, expect, it } from "bun:test";

import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import {
  findMediaUsage,
  normalizeMediaTags,
  queryMediaLibrary,
} from "@/domain/media/media-rules";
import type { Project } from "@/domain/projects/project";
import { parseMediaAsset } from "@/services/media/media-repository";

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "m1",
    workspaceId: "local-media",
    name: "Blue Worship",
    kind: "image",
    mimeType: "image/png",
    sizeBytes: 100,
    storage: "opfs",
    tags: ["azul", "worship"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    presentationUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const collections: MediaCollection[] = [
  {
    id: "worship",
    workspaceId: "local-media",
    name: "Adoración",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("Media Library rules", () => {
  it("normaliza tags y evita duplicados por case/acento", () => {
    expect(normalizeMediaTags([" Jóvenes ", "JOVENES", "Blue   Sky", ""])).toEqual([
      "jóvenes",
      "blue sky",
    ]);
  });

  it("combina colección, tipo, favoritos y búsqueda por tags/colección", () => {
    const assets = [
      asset({ id: "a", collectionId: "worship" }),
      asset({ id: "b", name: "Anuncio", kind: "video", tags: ["rojo"] }),
    ];
    expect(
      queryMediaLibrary(assets, collections, {
        query: "adoracion azul",
        collectionId: "worship",
        filter: "favorites",
        favoriteIds: ["a"],
      }).map((item) => item.id),
    ).toEqual(["a"]);
    expect(
      queryMediaLibrary(assets, collections, {
        collectionId: "unassigned",
        filter: "video",
      }).map((item) => item.id),
    ).toEqual(["b"]);
  });

  it("ordena Recientes por MRU y duración con faltantes al final", () => {
    const assets = [
      asset({ id: "a", durationSeconds: 5 }),
      asset({ id: "b", durationSeconds: 20 }),
      asset({ id: "c", kind: "video" }),
    ];
    expect(
      queryMediaLibrary(assets, [], { filter: "recent", recentIds: ["b", "a"] }).map(
        (item) => item.id,
      ),
    ).toEqual(["b", "a"]);
    expect(queryMediaLibrary(assets, [], { sort: "duration" }).map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("normaliza assets v1 sin reimportar ni cambiar su identidad", () => {
    const legacy = { ...asset(), tags: undefined, presentationUpdatedAt: undefined };
    const parsed = parseMediaAsset(legacy);
    expect(parsed).toMatchObject({ id: "m1", tags: [] });
    expect(parsed?.presentationUpdatedAt).toBe(legacy.updatedAt);
  });
});

describe("findMediaUsage detallado", () => {
  it("informa contenido y backgrounds Song/Bible desde Projects", () => {
    const project = {
      id: "p1",
      workspaceId: "local-workspace",
      name: "Domingo",
      rundown: [
        { id: "i1", type: "media", sourceId: "m1", title: "Video", order: 0 },
        { id: "i2", type: "song", sourceId: "s1", title: "Song", order: 1, background: { type: "media", mediaId: "m1" } },
        { id: "i3", type: "bible", sourceId: "b1", title: "Bible", order: 2, background: { type: "media", mediaId: "m1" } },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Project;
    const usage = findMediaUsage([project], "m1");
    expect(usage.occurrences).toBe(3);
    expect(usage.references.map((reference) => reference.role)).toEqual([
      "content",
      "song-background",
      "bible-background",
    ]);
  });
});
