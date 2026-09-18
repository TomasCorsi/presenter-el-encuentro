import { describe, expect, it } from "bun:test";

import { removeFromLiveSession } from "@/features/live/live-session";
import type { LiveSession } from "@/features/live/live-session";
import type { PresentationItem } from "@/domain/presentation/presentation";
import type { Project } from "@/domain/project/project";

const project: Project = {
  id: "p1",
  workspaceId: "local-workspace",
  name: "Reunión",
  rundown: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function item(id: string): PresentationItem {
  return { id, type: "song", title: id, order: 0, slides: [] };
}

function session(staleExternal: boolean): LiveSession {
  return {
    snapshot: { projectId: "p1", items: [item("a"), item("b")], signature: "old" },
    staleExternal,
  };
}

describe("removeFromLiveSession", () => {
  it("quita solo ese item y adopta la firma nueva", () => {
    const next = removeFromLiveSession(session(false), {
      project, songs: [], presets: [], itemId: "a", wasOutdated: false,
    });

    expect(next.snapshot.items.map((entry) => entry.id)).toEqual(["b"]);
    expect(next.snapshot.signature).not.toBe("old");
    expect(next.staleExternal).toBe(false);
  });

  it("conserva un desfase externo pendiente", () => {
    const next = removeFromLiveSession(session(false), {
      project, songs: [], presets: [], itemId: "a", wasOutdated: true,
    });

    expect(next.staleExternal).toBe(true);
  });
});
