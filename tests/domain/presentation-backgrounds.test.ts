import { describe, expect, it } from "bun:test";

import type { MediaAsset } from "@/domain/media/media";
import { findMediaUsage } from "@/domain/media/media-rules";
import type { PresentationItem } from "@/domain/presentation/presentation";
import { resolvePresentationStyles } from "@/domain/presentation/resolve-presentation-styles";
import type { Project } from "@/domain/projects/project";
import { DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";

const preset: Preset = {
  id: "p1",
  workspaceId: "local-workspace",
  name: "Azul",
  style: {
    ...DEFAULT_PRESET_STYLE,
    background: { type: "solid", color: "#123456" },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const media: MediaAsset = {
  id: "media-bg",
  workspaceId: "local-media",
  name: "Fondo",
  kind: "video",
  mimeType: "video/mp4",
  sizeBytes: 100,
  storage: "opfs",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function item(background = true): PresentationItem {
  return {
    id: "item-1",
    type: "song",
    sourceId: "song-1",
    title: "Song",
    order: 0,
    presetId: "p1",
    background: background ? { type: "media", mediaId: media.id } : undefined,
    slides: [
      {
        id: "item-1:s1:0",
        itemId: "item-1",
        order: 0,
        content: { kind: "text", lines: ["Hola"] },
      },
    ],
  };
}

describe("resolved presentation backgrounds", () => {
  it("congela metadata Media encima del color del Preset", () => {
    const result = resolvePresentationStyles([item()], [preset], [media]);
    expect(result[0]?.slides[0]?.background).toEqual({
      type: "media",
      mediaId: "media-bg",
      kind: "video",
      fallbackColor: "#123456",
    });
  });

  it("cae al solido real del Preset cuando falta metadata", () => {
    const result = resolvePresentationStyles([item()], [preset], []);
    expect(result[0]?.slides[0]?.background).toEqual({ type: "solid", color: "#123456" });
  });

  it("sin override usa el solido congelado", () => {
    const result = resolvePresentationStyles([item(false)], [preset], [media]);
    expect(result[0]?.slides[0]?.background).toEqual({ type: "solid", color: "#123456" });
  });
});

describe("Media usage by backgrounds", () => {
  it("cuenta contenido, Song background y Bible background", () => {
    const project = {
      id: "project-1",
      workspaceId: "local-workspace",
      name: "Domingo",
      rundown: [
        { id: "m", type: "media", sourceId: media.id, title: "Media", order: 0 },
        {
          id: "s",
          type: "song",
          sourceId: "song-1",
          title: "Song",
          order: 1,
          background: { type: "media", mediaId: media.id },
        },
        {
          id: "b",
          type: "bible",
          sourceId: "bible-1",
          title: "Bible",
          order: 2,
          background: { type: "media", mediaId: media.id },
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Project;
    expect(findMediaUsage([project], media.id)).toEqual({
      occurrences: 3,
      projectNames: ["Domingo"],
    });
  });
});
