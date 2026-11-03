import { describe, expect, it } from "bun:test";
import { IDBFactory } from "fake-indexeddb";

import { DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import {
  APPLICATION_STORES,
  idbRequest,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import {
  MIGRATION_MARKERS,
  PRESETS_V1_KEY,
  PROJECTS_V1_KEY,
  PROJECTS_V2_KEY,
  SONGS_V1_KEY,
  migrateProjects,
} from "@/services/local-data/application-migrations";
import { bootstrapLocalData } from "@/services/local-data/local-data-bootstrap";
import { createIndexedDbPresetRepository } from "@/services/presets/indexeddb-preset-repository";
import { createIndexedDbProjectRepository } from "@/services/projects/indexeddb-project-repository";
import { createIndexedDbSongRepository } from "@/services/songs/indexeddb-song-repository";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const timestamp = "2026-10-16T12:00:00.000Z";

function project(id = "project-1", updatedAt = timestamp): Project {
  return { id, workspaceId: "local-workspace", name: `Proyecto ${id}`, rundown: [], createdAt: timestamp, updatedAt };
}

function song(id = "song-1", updatedAt = timestamp): Song {
  return {
    id, workspaceId: "local-workspace", title: `Canción ${id}`,
    sections: [{ id: `${id}-section`, type: "verse", label: "Verso 1", content: "Texto", order: 0 }],
    createdAt: timestamp, updatedAt,
  };
}

function preset(id = "preset-1", updatedAt = timestamp): Preset {
  return {
    id, workspaceId: "local-workspace", name: `Preset ${id}`,
    style: structuredClone(DEFAULT_PRESET_STYLE), createdAt: timestamp, updatedAt,
  };
}

async function metaValue(factory: IDBFactory, key: string): Promise<unknown> {
  const database = await openApplicationDatabase(factory);
  return (await idbRequest<{ key: string; value: unknown } | undefined>(
    database.transaction(APPLICATION_STORES.meta).objectStore(APPLICATION_STORES.meta).get(key),
  ))?.value;
}

describe("broadcast-control.app", () => {
  it("crea únicamente los stores de aplicación", async () => {
    const database = await openApplicationDatabase(new IDBFactory());
    expect([...database.objectStoreNames]).toEqual(["meta", "presets", "projects", "songs"]);
    expect(database.objectStoreNames.contains("media")).toBeFalse();
    expect(database.objectStoreNames.contains("bible")).toBeFalse();
  });

  it("mantiene CRUD y activeProjectId coherente", async () => {
    const factory = new IDBFactory();
    const repository = createIndexedDbProjectRepository(factory);
    await repository.create(project());
    await repository.setActiveProjectId("project-1");
    expect(await repository.getActiveProjectId()).toBe("project-1");
    await repository.update({ ...project(), name: "Actualizado" });
    expect((await repository.get("project-1"))?.name).toBe("Actualizado");
    await repository.delete("project-1");
    expect(await repository.list()).toEqual([]);
    expect(await repository.getActiveProjectId()).toBeNull();
  });

  it("implementa CRUD de Songs y Presets", async () => {
    const factory = new IDBFactory();
    const songs = createIndexedDbSongRepository(factory);
    const presets = createIndexedDbPresetRepository(factory);
    await songs.create(song());
    await presets.create(preset());
    await songs.update({ ...song(), title: "Nueva" });
    await presets.update({ ...preset(), name: "Nuevo" });
    expect((await songs.get("song-1"))?.title).toBe("Nueva");
    expect((await presets.get("preset-1"))?.name).toBe("Nuevo");
    await songs.delete("song-1");
    await presets.delete("preset-1");
    expect(await songs.list()).toEqual([]);
    expect(await presets.list()).toEqual([]);
  });
});

describe("migración localStorage → IndexedDB", () => {
  it("migra los tres dominios, activeProjectId y conserva exactamente legacy", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    const rawProjects = JSON.stringify({ version: 2, projects: [project()], activeProjectId: "project-1" });
    const rawSongs = JSON.stringify({ version: 1, songs: [song()] });
    const rawPresets = JSON.stringify({ version: 1, presets: [preset()] });
    storage.setItem(PROJECTS_V2_KEY, rawProjects);
    storage.setItem(SONGS_V1_KEY, rawSongs);
    storage.setItem(PRESETS_V1_KEY, rawPresets);

    const result = await bootstrapLocalData({ factory, storage, now: () => timestamp });
    expect(result.database).toBe("ready");
    expect(await result.repositories.projects.getActiveProjectId()).toBe("project-1");
    expect(await result.repositories.projects.list()).toHaveLength(1);
    expect(await result.repositories.songs.list()).toHaveLength(1);
    expect(await result.repositories.presets.list()).toHaveLength(1);
    expect(storage.getItem(PROJECTS_V2_KEY)).toBe(rawProjects);
    expect(storage.getItem(SONGS_V1_KEY)).toBe(rawSongs);
    expect(storage.getItem(PRESETS_V1_KEY)).toBe(rawPresets);
  });

  it("recupera Projects v1 si v2 está corrupto sin modificar ninguno", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    const corrupt = "{v2-corrupto";
    const legacy = JSON.stringify({
      version: 1,
      projects: [{ ...project(), rundown: undefined, itemIds: ["legacy"] }],
      activeProjectId: "project-1",
    });
    storage.setItem(PROJECTS_V2_KEY, corrupt);
    storage.setItem(PROJECTS_V1_KEY, legacy);
    const result = await migrateProjects(factory, storage, () => timestamp);
    expect(result.state).toBe("complete");
    expect(result.source).toBe("local-storage-v1");
    expect(result.warning).toContain("v2 era inválido");
    expect(storage.getItem(PROJECTS_V2_KEY)).toBe(corrupt);
    expect(storage.getItem(PROJECTS_V1_KEY)).toBe(legacy);
  });

  it("no escribe entidades ni marcador si la transacción falla", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    storage.setItem(PROJECTS_V2_KEY, JSON.stringify({ version: 2, projects: [project()], activeProjectId: null }));
    await expect(migrateProjects(factory, storage, () => { throw new Error("fallo simulado"); })).rejects.toThrow("fallo simulado");
    expect(await createIndexedDbProjectRepository(factory).list()).toEqual([]);
    expect(await metaValue(factory, MIGRATION_MARKERS.projects)).toBeUndefined();
  });

  it("marca corrupción como degradada, preserva raw y bloquea escrituras destructivas", async () => {
    const factory = new IDBFactory();
    const storage = new MemoryStorage();
    const raw = "{json-corrupto";
    storage.setItem(SONGS_V1_KEY, raw);
    const result = await bootstrapLocalData({ factory, storage, now: () => timestamp });
    expect(result.database).toBe("degraded");
    expect(result.migrations.find((entry) => entry.domain === "songs")?.state).toBe("degraded");
    await expect(result.repositories.songs.list()).rejects.toThrow("JSON inválido");
    await expect(result.repositories.songs.create(song())).rejects.toThrow("JSON inválido");
    expect(storage.getItem(SONGS_V1_KEY)).toBe(raw);
    expect(await metaValue(factory, MIGRATION_MARKERS.songs)).toBeUndefined();
  });

  it("hace merge por updatedAt, conserva IndexedDB en empate y es idempotente", async () => {
    const factory = new IDBFactory();
    const repository = createIndexedDbProjectRepository(factory);
    await repository.create({ ...project("newer", "2026-10-16T14:00:00.000Z"), name: "IDB newer" });
    await repository.create({ ...project("tie"), name: "IDB tie" });
    const storage = new MemoryStorage();
    storage.setItem(PROJECTS_V2_KEY, JSON.stringify({
      version: 2,
      projects: [
        { ...project("newer", "2026-10-16T13:00:00.000Z"), name: "Legacy older" },
        { ...project("tie"), name: "Legacy tie" },
        project("only-legacy"),
      ],
      activeProjectId: "only-legacy",
    }));
    await migrateProjects(factory, storage, () => timestamp);
    expect((await repository.get("newer"))?.name).toBe("IDB newer");
    expect((await repository.get("tie"))?.name).toBe("IDB tie");
    expect(await repository.get("only-legacy")).not.toBeNull();

    storage.setItem(PROJECTS_V2_KEY, JSON.stringify({ version: 2, projects: [project("late")], activeProjectId: null }));
    const second = await migrateProjects(factory, storage, () => "later");
    expect(second.state).toBe("complete");
    expect(await repository.get("late")).toBeNull();
  });
});
