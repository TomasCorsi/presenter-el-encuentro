import { describe, expect, test } from "bun:test";

import { projectToPresentation } from "@/domain/presentation/project-to-presentation";
import type { Project } from "@/domain/projects/project";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";
import type { MediaAsset } from "@/domain/media/media";

function song(id: string, title: string): Song {
  return {
    id,
    workspaceId: "local-workspace",
    title,
    sections: [
      { id: `${id}-s1`, type: "verse", label: "Verso 1", content: "línea 1\nlínea 2", order: 0 },
      { id: `${id}-s2`, type: "chorus", label: "Coro", content: "coro", order: 1 },
    ],
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
}

function project(rundown: RundownItem[]): Project {
  return {
    id: "project-1",
    workspaceId: "local-workspace",
    name: "Domingo",
    rundown,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
}

function media(id: string, kind: "image" | "video"): MediaAsset {
  return {
    id,
    workspaceId: "local-media",
    name: kind === "image" ? "Fondo" : "Clip",
    kind,
    mimeType: kind === "image" ? "image/png" : "video/webm",
    sizeBytes: 10,
    storage: "opfs",
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
}

describe("project to presentation", () => {
  test("respects rundown order and maps instance/source identity", () => {
    const songs = [song("song-a", "Grande y Fuerte"), song("song-b", "Santo por Siempre")];
    const items = projectToPresentation(
      project([
        { id: "item-2", type: "song", sourceId: "song-b", title: "Santo por Siempre", order: 1 },
        { id: "item-1", type: "song", sourceId: "song-a", title: "Grande y Fuerte", order: 0 },
      ]),
      songs,
    );

    expect(items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
    expect(items.map((item) => item.order)).toEqual([0, 1]);
    expect(items.map((item) => item.sourceId)).toEqual(["song-a", "song-b"]);
    expect(items[0]?.slides).toHaveLength(2);
  });

  test("repeats the same song without slide id collisions", () => {
    const items = projectToPresentation(
      project([
        { id: "item-1", type: "song", sourceId: "song-a", title: "A", order: 0 },
        { id: "item-3", type: "song", sourceId: "song-a", title: "A", order: 1 },
      ]),
      [song("song-a", "A")],
    );

    const slideIds = items.flatMap((item) => item.slides.map((slide) => slide.id));
    expect(new Set(slideIds).size).toBe(slideIds.length);
    expect(slideIds[0]).toBe("item-1:song-a-s1:0");
    expect(slideIds[2]).toBe("item-3:song-a-s1:0");
  });

  test("keeps broken references as items without slides", () => {
    const items = projectToPresentation(
      project([
        { id: "item-1", type: "song", sourceId: "song-x", title: "Canción borrada", order: 0 },
      ]),
      [],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Canción borrada");
    expect(items[0]?.sourceId).toBe("song-x");
    expect(items[0]?.slides).toEqual([]);
  });

  test("returns an empty presentation for an empty rundown", () => {
    expect(projectToPresentation(project([]), [song("song-a", "A")])).toEqual([]);
  });

  test("convierte imágenes y videos por referencia y conserva Media faltante", () => {
    const items = projectToPresentation(
      project([
        { id: "image-item", type: "media", sourceId: "image-1", title: "Fondo", order: 0 },
        { id: "video-item", type: "media", sourceId: "video-1", title: "Clip", order: 1 },
        { id: "missing-item", type: "media", sourceId: "missing", title: "Viejo", order: 2 },
      ]),
      [],
      [media("image-1", "image"), media("video-1", "video")],
    );

    expect(items[0]?.slides[0]?.content).toEqual({ kind: "image", mediaId: "image-1" });
    expect(items[1]?.slides[0]?.content).toEqual({ kind: "video", mediaId: "video-1" });
    expect(items[2]?.slides).toEqual([]);
  });
});
