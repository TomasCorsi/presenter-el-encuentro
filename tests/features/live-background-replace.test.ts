import { describe, expect, it } from "bun:test";

import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import {
  buildReplacementItem,
  createLiveSession,
  isLiveSessionOutdated,
  replaceInLiveSession,
} from "@/features/live/live-session";

const song: Song = {
  id: "song-1",
  workspaceId: "local-workspace",
  title: "Song",
  sections: [{ id: "verse", type: "verse", label: "Verso", content: "Hola", order: 0 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const project: Project = {
  id: "project-1",
  workspaceId: "local-workspace",
  name: "Domingo",
  rundown: [{ id: "item-1", type: "song", sourceId: song.id, title: song.title, order: 0 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Live background replacement", () => {
  it("keeps the loaded snapshot frozen when Project Detail changes the background", () => {
    const session = createLiveSession({ project, songs: [song], presets: [], media: [] });
    const externallySaved: Project = {
      ...project,
      updatedAt: "2026-01-02T00:00:00.000Z",
      rundown: project.rundown.map((entry) => ({
        ...entry,
        background: { type: "media" as const, mediaId: "missing" },
      })),
    };

    expect(
      isLiveSessionOutdated(session, {
        project: externallySaved,
        songs: [song],
        presets: [],
        media: [],
      }),
    ).toBe(true);
    expect(session.snapshot.items[0]?.slides[0]?.background).toEqual({
      type: "solid",
      color: "#0B0D10",
    });
  });

  it("replaces only the edited frozen item and preserves external stale state", () => {
    const session = createLiveSession({ project, songs: [song], presets: [], media: [] });
    const saved: Project = {
      ...project,
      updatedAt: "2026-01-02T00:00:00.000Z",
      rundown: project.rundown.map((entry) => ({
        ...entry,
        background: { type: "media" as const, mediaId: "missing" },
      })),
    };
    const sources = { project: saved, songs: [song], presets: [], media: [] };
    const replacement = buildReplacementItem(sources, "item-1");
    const next = replaceInLiveSession(session, {
      ...sources,
      item: replacement!,
      wasOutdated: true,
    });

    expect(next.snapshot.items).toHaveLength(1);
    expect(next.snapshot.items[0]).not.toBe(session.snapshot.items[0]);
    expect(next.snapshot.items[0]?.slides[0]?.background).toEqual({
      type: "solid",
      color: "#0B0D10",
    });
    expect(next.staleExternal).toBe(true);
  });
});
