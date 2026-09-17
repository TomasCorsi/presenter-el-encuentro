import { describe, expect, test } from "bun:test";

import type { Project } from "@/domain/projects/project";
import type { RundownItem } from "@/domain/projects/rundown";
import {
  addSongToRundown,
  duplicateRundown,
  findSongUsage,
  moveRundownItem,
  normalizeRundown,
  removeRundownItem,
  setRundownItemPreset,
} from "@/domain/projects/rundown-rules";

function createIdSequence(prefix: string) {
  let sequence = 0;
  return { createId: () => `${prefix}-${++sequence}` };
}

function buildRundown(): RundownItem[] {
  const dependencies = createIdSequence("item");
  let rundown: RundownItem[] = [];
  rundown = addSongToRundown(rundown, { songId: "song-a", title: "Grande y Fuerte" }, dependencies);
  rundown = addSongToRundown(rundown, { songId: "song-b", title: "Santo por Siempre" }, dependencies);
  rundown = addSongToRundown(rundown, { songId: "song-a", title: "Grande y Fuerte" }, dependencies);
  return rundown;
}

describe("rundown rules", () => {
  test("adds songs at the end with sequential order", () => {
    const rundown = buildRundown();
    expect(rundown.map((item) => item.order)).toEqual([0, 1, 2]);
    expect(rundown.map((item) => item.sourceId)).toEqual(["song-a", "song-b", "song-a"]);
    expect(rundown[0]?.type).toBe("song");
  });

  test("repeats the same song with distinct instance ids", () => {
    const rundown = buildRundown();
    const [first, , third] = rundown;
    expect(first?.sourceId).toBe(third?.sourceId as string);
    expect(first?.id).not.toBe(third?.id as string);
  });

  test("moves items and is a no-op at the edges", () => {
    const rundown = buildRundown();
    const firstId = rundown[0]?.id as string;
    const lastId = rundown[2]?.id as string;

    const movedDown = moveRundownItem(rundown, firstId, "down");
    expect(movedDown.map((item) => item.sourceId)).toEqual(["song-b", "song-a", "song-a"]);
    expect(movedDown.map((item) => item.order)).toEqual([0, 1, 2]);

    expect(moveRundownItem(rundown, firstId, "up").map((item) => item.id)).toEqual(
      rundown.map((item) => item.id),
    );
    expect(moveRundownItem(rundown, lastId, "down").map((item) => item.id)).toEqual(
      rundown.map((item) => item.id),
    );
    expect(moveRundownItem(rundown, "missing", "up").map((item) => item.id)).toEqual(
      rundown.map((item) => item.id),
    );
  });

  test("removes only that instance and renormalizes order", () => {
    const rundown = buildRundown();
    const removed = removeRundownItem(rundown, rundown[0]?.id as string);
    expect(removed).toHaveLength(2);
    expect(removed.map((item) => item.sourceId)).toEqual(["song-b", "song-a"]);
    expect(removed.map((item) => item.order)).toEqual([0, 1]);
  });

  test("normalizes arbitrary order values to 0..n-1", () => {
    const messy: RundownItem[] = [
      { id: "c", type: "song", sourceId: "s", title: "C", order: 9 },
      { id: "a", type: "song", sourceId: "s", title: "A", order: 2 },
      { id: "b", type: "song", sourceId: "s", title: "B", order: 5 },
    ];
    expect(normalizeRundown(messy).map((item) => [item.id, item.order])).toEqual([
      ["a", 0], ["b", 1], ["c", 2],
    ]);
  });

  test("duplicates the rundown with new instance ids and same sources", () => {
    const rundown = buildRundown();
    const copy = duplicateRundown(rundown, createIdSequence("copy"));
    expect(copy.map((item) => item.sourceId)).toEqual(rundown.map((item) => item.sourceId));
    expect(copy.map((item) => item.id)).toEqual(["copy-1", "copy-2", "copy-3"]);
    expect(copy.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  test("counts song usage across projects as a pure rule", () => {
    const base: Omit<Project, "rundown"> = {
      id: "project-1", workspaceId: "local-workspace", name: "Domingo",
      createdAt: "2026-09-17T00:00:00.000Z", updatedAt: "2026-09-17T00:00:00.000Z",
    };
    const projects: Project[] = [
      { ...base, rundown: buildRundown() },
      { ...base, id: "project-2", name: "Conferencia", rundown: [] },
    ];

    expect(findSongUsage(projects, "song-a")).toEqual({ occurrences: 2, projectNames: ["Domingo"] });
    expect(findSongUsage(projects, "song-z")).toEqual({ occurrences: 0, projectNames: [] });
  });
});

describe("preset por aparición del rundown", () => {
  test("asigna un preset distinto a cada aparición de la misma canción", () => {
    let rundown = buildRundown();
    rundown = setRundownItemPreset(rundown, "item-1", "preset-lyrics");
    rundown = setRundownItemPreset(rundown, "item-3", "preset-cierre");

    expect(rundown[0]?.presetId).toBe("preset-lyrics");
    expect(rundown[2]?.presetId).toBe("preset-cierre");
    expect(rundown[1]?.presetId).toBeUndefined();
  });

  test("quitar el preset deja el item sin asignación (cae al Default)", () => {
    let rundown = setRundownItemPreset(buildRundown(), "item-1", "preset-lyrics");
    rundown = setRundownItemPreset(rundown, "item-1", undefined);

    expect(rundown[0]).not.toHaveProperty("presetId");
  });

  test("un itemId inexistente no altera el rundown", () => {
    const rundown = buildRundown();

    expect(setRundownItemPreset(rundown, "no-existe", "preset-x")).toEqual(rundown);
  });
});
