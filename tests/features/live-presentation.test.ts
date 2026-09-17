import { describe, expect, it } from "bun:test";

import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import { buildLiveSnapshot, presentationSignature } from "@/features/live/live-presentation";

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
    ]);

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

    expect(presentationSignature(p, songs)).toBe(presentationSignature(p, songs));
  });

  it("detecta cambios en el rundown", () => {
    const before = presentationSignature(project("2026-01-02T00:00:00.000Z", ["a"]), songs);
    const after = presentationSignature(project("2026-01-03T00:00:00.000Z", ["a", "a"]), songs);

    expect(after).not.toBe(before);
  });

  it("detecta cambios en una canción referenciada", () => {
    const p = project("2026-01-02T00:00:00.000Z", ["a"]);
    const after = presentationSignature(p, [song("a", "2026-01-05T00:00:00.000Z")]);

    expect(after).not.toBe(presentationSignature(p, songs));
  });
});
