import { describe, expect, test } from "bun:test";

import type { Project } from "@/domain/projects/project";
import { ProjectService } from "@/features/projects/project-service";
import { createLocalStorageProjectRepository, type KeyValueStorage } from "./local-storage-project-repository";

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  setRaw(value: string) { this.values.set("broadcast-control.projects.v1", value); }
}

const project: Project = {
  id: "project-1", workspaceId: "local-workspace", name: "Domingo", itemIds: [],
  createdAt: "2026-09-17T00:00:00.000Z", updatedAt: "2026-09-17T00:00:00.000Z",
};

describe("local storage project repository", () => {
  test("persists CRUD and active project across repository instances", async () => {
    const storage = new MemoryStorage();
    const first = createLocalStorageProjectRepository(storage);
    await first.create(project);
    await first.setActiveProjectId(project.id);

    const second = createLocalStorageProjectRepository(storage);
    expect(await second.get(project.id)).toEqual(project);
    expect(await second.getActiveProjectId()).toBe(project.id);

    await second.update({ ...project, name: "Domingo tarde" });
    expect((await first.list())[0]?.name).toBe("Domingo tarde");
    await second.delete(project.id);
    expect(await first.list()).toEqual([]);
    expect(await first.getActiveProjectId()).toBeNull();
  });

  test("recovers safely from invalid local data", async () => {
    const storage = new MemoryStorage();
    storage.setRaw("not-json");
    const repository = createLocalStorageProjectRepository(storage);
    expect(await repository.list()).toEqual([]);
    expect(await repository.getActiveProjectId()).toBeNull();
  });

  test("keeps duplication in the service and clears an active deletion", async () => {
    const repository = createLocalStorageProjectRepository(new MemoryStorage());
    let sequence = 0;
    const service = new ProjectService(repository, {
      createId: () => `project-${++sequence}`,
      now: () => `2026-09-${17 + sequence}T00:00:00.000Z`,
    });
    const original = await service.create({ name: "Reunión" });
    const copy = await service.duplicate(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Reunión — copia");
    await service.setActiveProject(original.id);
    await service.delete(original.id);
    expect((await service.load()).activeProjectId).toBeNull();
  });
});