import { describe, expect, it } from "bun:test";

import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import {
  appendToLiveSession,
  buildAppendedItem,
  createLiveSession,
  isLiveSessionOutdated,
  reloadLiveSession,
} from "@/features/live/live-session";

function song(id: string, updatedAt = "2026-01-02T00:00:00.000Z"): Song {
  return {
    id,
    workspaceId: "local-workspace",
    title: `Canción ${id}`,
    sections: [{ id: `${id}-s1`, type: "verse", label: "Verso 1", content: "línea uno", order: 0 }],
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

const songs = [song("a"), song("b")];
const base = project("2026-01-02T00:00:00.000Z", ["a"]);

describe("sesión de Live", () => {
  it("arranca sin desfase", () => {
    const session = createLiveSession({ project: base, songs, presets: [] });

    expect(session.staleExternal).toBe(false);
    expect(isLiveSessionOutdated(session, { project: base, songs, presets: [] })).toBe(false);
    expect(session.snapshot.items).toHaveLength(1);
  });

  it("detecta un cambio externo en una canción del show", () => {
    const session = createLiveSession({ project: base, songs, presets: [] });
    const changed = [song("a", "2026-02-01T00:00:00.000Z"), song("b")];

    expect(isLiveSessionOutdated(session, { project: base, songs: changed, presets: [] })).toBe(true);
  });

  it("agregar contenido añade solo el item nuevo y no genera falso aviso", () => {
    const session = createLiveSession({ project: base, songs, presets: [] });
    const saved = project("2026-01-03T00:00:00.000Z", ["a", "b"]);
    const item = buildAppendedItem({ project: saved, songs, presets: [] }, "item-1");
    expect(item).not.toBeNull();

    const next = appendToLiveSession(session, {
      project: saved,
      songs,
      presets: [],
      item: item!,
      wasOutdated: false,
    });

    expect(next.snapshot.items).toHaveLength(2);
    expect(next.snapshot.items[0]).toBe(session.snapshot.items[0]!);
    expect(next.staleExternal).toBe(false);
    expect(isLiveSessionOutdated(next, { project: saved, songs, presets: [] })).toBe(false);
  });

  it("conserva un desfase externo previo tras agregar contenido", () => {
    const session = createLiveSession({ project: base, songs, presets: [] });
    const changed = [song("a", "2026-02-01T00:00:00.000Z"), song("b")];
    const saved = project("2026-01-03T00:00:00.000Z", ["a", "b"]);
    const item = buildAppendedItem({ project: saved, songs: changed, presets: [] }, "item-1");

    const next = appendToLiveSession(session, {
      project: saved,
      songs: changed,
      presets: [],
      item: item!,
      wasOutdated: true,
    });

    expect(next.staleExternal).toBe(true);
    expect(isLiveSessionOutdated(next, { project: saved, songs: changed, presets: [] })).toBe(true);
    // El contenido congelado del item original NO se reconstruye.
    expect(next.snapshot.items[0]).toBe(session.snapshot.items[0]!);
  });

  it("la recarga explícita incorpora los cambios externos y limpia el desfase", () => {
    const changed = [song("a", "2026-02-01T00:00:00.000Z"), song("b")];
    const reloaded = reloadLiveSession({ project: base, songs: changed, presets: [] });

    expect(reloaded.staleExternal).toBe(false);
    expect(isLiveSessionOutdated(reloaded, { project: base, songs: changed, presets: [] })).toBe(false);
  });
});
