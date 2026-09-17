import { describe, expect, it } from "bun:test";

import { DEFAULT_PRESET_ID, DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";
import {
  STORAGE_KEY,
  createLocalStoragePresetRepository,
  type KeyValueStorage,
} from "@/services/presets/local-storage-preset-repository";

function memoryStorage(initial?: string): KeyValueStorage & { raw(): string | null } {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    raw: () => value,
  };
}

function preset(id = "p-a"): Preset {
  return {
    id,
    workspaceId: "local-workspace",
    name: `Preset ${id}`,
    style: { ...DEFAULT_PRESET_STYLE },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("localStorage preset repository", () => {
  it("persiste, lee, actualiza y elimina", async () => {
    const storage = memoryStorage();
    const repository = createLocalStoragePresetRepository(storage);

    await repository.create(preset());
    expect(await repository.list()).toHaveLength(1);

    await repository.update({ ...preset(), name: "Renombrado" });
    expect((await repository.get("p-a"))?.name).toBe("Renombrado");

    await repository.delete("p-a");
    expect(await repository.list()).toEqual([]);
    expect(storage.raw()).toContain(STORAGE_KEY.length ? "presets" : "");
  });

  it("ignora datos corruptos sin lanzar", async () => {
    expect(await createLocalStoragePresetRepository(memoryStorage("{no json")).list()).toEqual([]);
    expect(
      await createLocalStoragePresetRepository(memoryStorage('{"version":9,"presets":[]}')).list(),
    ).toEqual([]);
  });

  it("descarta registros sin identidad y nunca persiste el id reservado", async () => {
    const raw = JSON.stringify({
      version: 1,
      presets: [{ nombre: "roto" }, { ...preset(DEFAULT_PRESET_ID) }, preset("p-ok")],
    });

    const list = await createLocalStoragePresetRepository(memoryStorage(raw)).list();

    expect(list.map((item) => item.id)).toEqual(["p-ok"]);
  });

  it("normaliza un estilo inválido en lugar de perder el preset", async () => {
    const raw = JSON.stringify({
      version: 1,
      presets: [{ ...preset(), style: { fontSize: "grande", background: null } }],
    });

    const list = await createLocalStoragePresetRepository(memoryStorage(raw)).list();

    expect(list[0]?.style).toEqual(DEFAULT_PRESET_STYLE);
  });
});
