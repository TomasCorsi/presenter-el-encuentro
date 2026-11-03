import { describe, expect, it } from "bun:test";

import type { Project } from "@/domain/projects/project";
import type { MediaAsset } from "@/domain/media/media";
import type { Song } from "@/domain/songs/song";
import { DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";
import { buildLiveSnapshot, presentationSignature } from "@/features/live/live-presentation";

function preset(id: string, updatedAt: string, fontSize = 8): Preset {
  return {
    id,
    workspaceId: "local-workspace",
    name: `Preset ${id}`,
    style: { ...DEFAULT_PRESET_STYLE, fontSize },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

function song(id: string, updatedAt: string): Song {
  return {
    id,
    workspaceId: "local-workspace",
    title: `Canción ${id}`,
    sections: [
      { id: `${id}-s1`, type: "verse", label: "Verso 1", content: "línea uno", order: 0 },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

function project(updatedAt: string, sourceIds: string[]): Project {
  return {
    id: "p1",
    workspaceId: "local-workspace",
    name: "Show",
    rundown: sourceIds.map((sourceId, index) => ({
      id: `item-${index}`,
      type: "song" as const,
      title: `Canción ${sourceId}`,
      sourceId,
      order: index,
    })),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("buildLiveSnapshot", () => {
  it("compone el show a partir del Project y la biblioteca", () => {
    const snapshot = buildLiveSnapshot(project("2026-01-02T00:00:00.000Z", ["a", "a"]), [
      song("a", "2026-01-02T00:00:00.000Z"),
    ], []);

    expect(snapshot.projectId).toBe("p1");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0]?.id).toBe("item-0");
    expect(snapshot.items[1]?.id).toBe("item-1");
    expect(snapshot.items[0]?.slides[0]?.id).not.toBe(snapshot.items[1]?.slides[0]?.id);
  });

  it("conserva las referencias rotas como items sin slides", () => {
    const snapshot = buildLiveSnapshot(project("2026-01-02T00:00:00.000Z", ["fantasma"]), []);

    expect(snapshot.items[0]?.slides).toHaveLength(0);
  });
});

describe("presentationSignature", () => {
  const songs = [song("a", "2026-01-02T00:00:00.000Z")];

  it("es estable con el mismo origen", () => {
    const p = project("2026-01-02T00:00:00.000Z", ["a"]);

    expect(presentationSignature(p, songs, [])).toBe(presentationSignature(p, songs, []));
  });

  it("detecta cambios en el rundown", () => {
    const before = presentationSignature(project("2026-01-02T00:00:00.000Z", ["a"]), songs, []);
    const after = presentationSignature(project("2026-01-03T00:00:00.000Z", ["a", "a"]), songs, []);

    expect(after).not.toBe(before);
  });

  it("detecta cambios en una canción referenciada", () => {
    const p = project("2026-01-02T00:00:00.000Z", ["a"]);
    const after = presentationSignature(p, [song("a", "2026-01-05T00:00:00.000Z")], []);

    expect(after).not.toBe(presentationSignature(p, songs, []));
  });
});

describe("presentationSignature de Media", () => {
  const mediaProject = {
    id: "p-media",
    workspaceId: "local-workspace",
    name: "Media",
    rundown: [{ id: "i1", type: "media", sourceId: "m1", title: "Media", order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as Project;
  const media: MediaAsset = {
    id: "m1",
    workspaceId: "local-media",
    name: "Fondo",
    kind: "image",
    mimeType: "image/png",
    sizeBytes: 10,
    storage: "opfs",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    presentationUpdatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("ignora organización y usa únicamente presentationUpdatedAt", () => {
    const before = presentationSignature(mediaProject, [], [], [media]);
    const organized = {
      ...media,
      collectionId: "c1",
      tags: ["worship"],
      updatedAt: "2026-01-09T00:00:00.000Z",
    };
    expect(presentationSignature(mediaProject, [], [], [organized])).toBe(before);
    expect(
      presentationSignature(mediaProject, [], [], [
        { ...organized, presentationUpdatedAt: "2026-01-10T00:00:00.000Z" },
      ]),
    ).not.toBe(before);
  });
});

describe("resolución de Presets en el snapshot de Live", () => {
  const songs = [song("a", "2026-01-02T00:00:00.000Z")];

  function projectWithPresets(presetIds: (string | undefined)[]): Project {
    const base = project("2026-01-02T00:00:00.000Z", presetIds.map(() => "a"));
    return {
      ...base,
      rundown: base.rundown.map((item, index) => {
        const presetId = presetIds[index];
        return presetId === undefined ? item : { ...item, presetId };
      }),
    };
  }

  it("congela el estilo del Preset de cada aparición", () => {
    const snapshot = buildLiveSnapshot(projectWithPresets(["p-a", "p-b"]), songs, [
      preset("p-a", "2026-01-02T00:00:00.000Z", 7),
      preset("p-b", "2026-01-02T00:00:00.000Z", 14),
    ]);

    expect(snapshot.items[0]?.slides[0]?.style?.fontSize).toBe(7);
    expect(snapshot.items[1]?.slides[0]?.style?.fontSize).toBe(14);
  });

  it("cae al Default si el item no tiene preset o el id ya no existe", () => {
    const snapshot = buildLiveSnapshot(projectWithPresets([undefined, "borrado"]), songs, []);

    expect(snapshot.items[0]?.slides[0]?.style).toEqual(DEFAULT_PRESET_STYLE);
    expect(snapshot.items[1]?.slides[0]?.style).toEqual(DEFAULT_PRESET_STYLE);
  });

  it("la firma cambia cuando se edita un Preset en uso", () => {
    const p = projectWithPresets(["p-a"]);
    const before = presentationSignature(p, songs, [preset("p-a", "2026-01-02T00:00:00.000Z")]);
    const after = presentationSignature(p, songs, [preset("p-a", "2026-01-09T00:00:00.000Z", 20)]);

    expect(after).not.toBe(before);
  });
});
