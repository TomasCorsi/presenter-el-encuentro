import { describe, expect, test } from "bun:test";

import { PROJECT_NAME_MAX_LENGTH, type ProjectFactoryDependencies } from "@/domain/projects/project";
import { createProject, duplicateProject, filterProjects, normalizeProjectName, renameProject, sortProjectsByUpdatedAt } from "@/domain/projects/project-rules";

const dependencies: ProjectFactoryDependencies = {
  createId: () => "project-1",
  now: () => "2026-09-17T00:00:00.000Z",
};

describe("project rules", () => {
  test("validates and trims names", () => {
    expect(normalizeProjectName("  Reunión  ")).toBe("Reunión");
    expect(() => normalizeProjectName("   ")).toThrow("obligatorio");
    expect(() => normalizeProjectName("x".repeat(PROJECT_NAME_MAX_LENGTH + 1))).toThrow("100");
  });

  test("creates a minimal project with stable identity and dates", () => {
    expect(createProject({ name: "  Domingo  " }, dependencies)).toEqual({
      id: "project-1", workspaceId: "local-workspace", name: "Domingo", rundown: [],
      createdAt: dependencies.now(), updatedAt: dependencies.now(),
    });
  });

  test("renames without changing creation identity", () => {
    const original = createProject({ name: "Domingo" }, dependencies);
    const renamed = renameProject(original, "  Conferencia ", () => "2026-09-18T00:00:00.000Z");
    expect(renamed.id).toBe(original.id);
    expect(renamed.createdAt).toBe(original.createdAt);
    expect(renamed.name).toBe("Conferencia");
    expect(renamed.updatedAt).toBe("2026-09-18T00:00:00.000Z");
  });

  test("duplicates the rundown with new instance ids and respects the name limit", () => {
    const original = {
      ...createProject({ name: "x".repeat(100) }, dependencies),
      rundown: [{ id: "item-1", type: "song" as const, sourceId: "song-a", title: "A", order: 0 }],
    };
    let sequence = 0;
    const copy = duplicateProject(original, {
      createId: () => (++sequence === 1 ? "project-2" : `item-copy-${sequence}`),
      now: () => "2026-09-19T00:00:00.000Z",
    });
    expect(copy.id).toBe("project-2");
    expect(copy.name.endsWith(" — copia")).toBe(true);
    expect(copy.name.length).toBeLessThanOrEqual(100);
    expect(copy.rundown[0]?.sourceId).toBe("song-a");
    expect(copy.rundown[0]?.id).not.toBe("item-1");
    expect(copy.rundown).not.toBe(original.rundown);
  });

  test("filters case-insensitively and sorts by latest update", () => {
    const oldProject = createProject({ name: "Culto Domingo" }, dependencies);
    const newProject = { ...oldProject, id: "project-2", name: "Conferencia", updatedAt: "2026-09-18T00:00:00.000Z" };
    expect(filterProjects([oldProject, newProject], "  DOMINGO ")).toEqual([oldProject]);
    expect(sortProjectsByUpdatedAt([oldProject, newProject]).map((project) => project.id)).toEqual(["project-2", "project-1"]);
  });
});