import { describe, expect, it } from "bun:test";

import type { Song } from "@/domain/songs/song";
import { createLocalStorageSongRepository, type KeyValueStorage } from "@/services/songs/local-storage-song-repository";

function createMemoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

function song(id: string): Song {
  return {
    id,
    workspaceId: "local-workspace",
    title: `Canción ${id}`,
    sections: [{ id: `${id}-s1`, type: "verse", label: "Verso 1", content: "letra", order: 0 }],
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
  };
}

describe("localStorageSongRepository", () => {
  it("crea, lista, obtiene, actualiza y elimina canciones", async () => {
    const repository = createLocalStorageSongRepository(createMemoryStorage());
    await repository.create(song("a"));
    await repository.create(song("b"));

    expect((await repository.list()).map((item) => item.id)).toEqual(["a", "b"]);
    expect((await repository.get("a"))?.title).toBe("Canción a");

    await repository.update({ ...song("a"), title: "Renombrada" });
    expect((await repository.get("a"))?.title).toBe("Renombrada");

    await repository.delete("a");
    expect(await repository.get("a")).toBeNull();
    expect((await repository.list()).map((item) => item.id)).toEqual(["b"]);
  });

  it("rechaza duplicar un identificador existente", async () => {
    const repository = createLocalStorageSongRepository(createMemoryStorage());
    await repository.create(song("a"));
    await expect(repository.create(song("a"))).rejects.toThrow("Ya existe");
  });

  it("rechaza actualizar una canción inexistente", async () => {
    const repository = createLocalStorageSongRepository(createMemoryStorage());
    await expect(repository.update(song("x"))).rejects.toThrow("ya no existe");
  });

  it("devuelve estado vacío ante JSON inválido o estructura corrupta", async () => {
    const storage = createMemoryStorage();
    storage.data.set("broadcast-control.songs.v1", "{no-json");
    expect(await createLocalStorageSongRepository(storage).list()).toEqual([]);

    storage.data.set("broadcast-control.songs.v1", JSON.stringify({ version: 99, songs: [] }));
    expect(await createLocalStorageSongRepository(storage).list()).toEqual([]);
  });

  it("descarta canciones con forma inválida y conserva las válidas", async () => {
    const storage = createMemoryStorage();
    storage.data.set("broadcast-control.songs.v1", JSON.stringify({
      version: 1,
      songs: [song("ok"), { id: "rota" }, { ...song("mala"), sections: [{ id: "s" }] }],
    }));
    const songs = await createLocalStorageSongRepository(storage).list();
    expect(songs.map((item) => item.id)).toEqual(["ok"]);
  });

  it("devuelve copias sin referencias mutables compartidas", async () => {
    const repository = createLocalStorageSongRepository(createMemoryStorage());
    await repository.create(song("a"));
    const listed = await repository.list();
    listed[0]!.sections[0]!.content = "mutado";
    expect((await repository.get("a"))?.sections[0]?.content).toBe("letra");
  });

  it("propaga errores de cuota del almacenamiento", async () => {
    const failing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    const repository = createLocalStorageSongRepository(failing);
    await expect(repository.create(song("a"))).rejects.toThrow("QuotaExceededError");
  });
});
