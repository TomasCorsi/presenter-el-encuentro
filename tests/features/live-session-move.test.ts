import { describe, expect, it } from "bun:test";

import { snapshotsEqual, toOutputSnapshot } from "@/domain/output/output-snapshot";
import { createInitialPlayback } from "@/domain/output/video-playback";
import type { PresentationItem } from "@/domain/presentation/presentation";
import { getProgramOutput } from "@/domain/presentation/presentation-selectors";
import type { Project } from "@/domain/projects/project";
import { moveInLiveSession, type LiveSession } from "@/features/live/live-session";
import { createPresentationStore } from "@/stores/presentation-store";

function item(id: string, order: number): PresentationItem {
  return { id, type: "song", title: id, order, slides: [] };
}

function session(staleExternal = false): LiveSession {
  return {
    snapshot: {
      projectId: "project",
      projectName: "Servicio",
      items: [item("a", 0), item("b", 1), item("external-removed", 2)],
      signature: "old",
    },
    staleExternal,
  };
}

const project: Project = {
  id: "project",
  workspaceId: "local-workspace",
  name: "Servicio",
  rundown: [
    { id: "b", type: "song", sourceId: "song-b", title: "B", order: 0 },
    { id: "a", type: "song", sourceId: "song-a", title: "A", order: 1 },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("moveInLiveSession", () => {
  it("reorders only the frozen snapshot and normalizes presentation order", () => {
    const next = moveInLiveSession(session(), {
      project,
      songs: [],
      presets: [],
      media: [],
      itemId: "a",
      direction: "down",
      wasOutdated: false,
    });

    expect(next.snapshot.items.map((entry) => entry.id)).toEqual(["b", "a", "external-removed"]);
    expect(next.snapshot.items.map((entry) => entry.order)).toEqual([0, 1, 2]);
    expect(next.snapshot.items.some((entry) => entry.id === "external-removed")).toBe(true);
    expect(next.snapshot.signature).not.toBe("old");
  });

  it("preserves a previously detected external mismatch", () => {
    const next = moveInLiveSession(session(), {
      project,
      songs: [],
      presets: [],
      media: [],
      itemId: "a",
      direction: "down",
      wasOutdated: true,
    });

    expect(next.staleExternal).toBe(true);
  });

  it("keeps Preview, Program, mode and visual Output while only changing order", () => {
    const current = session(true);
    const store = createPresentationStore();
    store.loadPresentation(
      current.snapshot.items.map((entry) => ({
        ...entry,
        slides: [
          {
            id: `${entry.id}:slide`,
            itemId: entry.id,
            order: 0,
            content:
              entry.id === "b"
                ? { kind: "video" as const, mediaId: "video-b" }
                : { kind: "text" as const, lines: [entry.id] },
          },
        ],
      })),
    );
    const liveSession: LiveSession = {
      ...current,
      snapshot: { ...current.snapshot, items: [...store.getState().runtime.items] },
    };
    store.selectSlide("b:slide");
    store.take();
    store.selectSlide("external-removed:slide");
    store.setProgramMode("black");
    const before = store.getState();

    const next = moveInLiveSession(liveSession, {
      project,
      songs: [],
      presets: [],
      media: [],
      itemId: "a",
      direction: "down",
      wasOutdated: true,
    });
    store.reorderPresentation(next.snapshot.items);
    const after = store.getState();

    expect(after.runtime.items.map((entry) => entry.id)).toEqual(["b", "a", "external-removed"]);
    expect(after.previewSlideId).toBe(before.previewSlideId);
    expect(after.programSlideId).toBe(before.programSlideId);
    expect(after.programMode).toBe("black");
    expect(after.detachedProgramSlide).toBeNull();
    expect(next.staleExternal).toBe(true);

    store.setProgramMode("content");
    const playback = createInitialPlayback(1_000);
    const outputBefore = toOutputSnapshot(
      getProgramOutput(store.getState()),
      "session",
      1,
      playback,
    );
    store.reorderPresentation([...store.getState().runtime.items].reverse());
    const outputAfter = toOutputSnapshot(
      getProgramOutput(store.getState()),
      "session",
      2,
      playback,
    );
    expect(snapshotsEqual(outputBefore, outputAfter)).toBe(true);
  });

  it("preserves detached Program when another item is reordered", () => {
    const store = createPresentationStore();
    const itemsWithSlides = [item("a", 0), item("b", 1), item("c", 2)].map((entry) => ({
      ...entry,
      slides: [
        {
          id: `${entry.id}:slide`,
          itemId: entry.id,
          order: 0,
          content: { kind: "text" as const, lines: [entry.id] },
        },
      ],
    }));
    store.loadPresentation(itemsWithSlides);
    store.selectSlide("b:slide");
    store.take();
    store.setProgramMode("clear");
    store.removePresentationItem("b");
    const before = store.getState();

    store.reorderPresentation([before.runtime.items[1]!, before.runtime.items[0]!]);
    const after = store.getState();

    expect(after.runtime.items.map((entry) => entry.id)).toEqual(["c", "a"]);
    expect(after.programSlideId).toBeNull();
    expect(after.detachedProgramSlide).toEqual(before.detachedProgramSlide);
    expect(after.programMode).toBe("clear");
  });
});
