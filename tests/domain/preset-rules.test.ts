import { describe, expect, it } from "bun:test";

import {
  DEFAULT_PRESET,
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_STYLE,
  type Preset,
} from "@/domain/presets/preset";
import {
  DefaultPresetError,
  PresetNameError,
  assertDeletable,
  createPreset,
  duplicatePreset,
  filterPresets,
  normalizePresetStyle,
  presetStylesEqual,
  renamePreset,
  sortPresets,
  updatePresetStyle,
} from "@/domain/presets/preset-rules";

let counter = 0;
const dependencies = {
  createId: () => `preset-${++counter}`,
  now: () => "2026-02-01T10:00:00.000Z",
};

function preset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: "preset-a",
    workspaceId: "local-workspace",
    name: "Lyrics Center",
    style: { ...DEFAULT_PRESET_STYLE },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createPreset", () => {
  it("crea un preset a partir del estilo por defecto", () => {
    const created = createPreset({ name: "  Versículo  " }, dependencies);

    expect(created.name).toBe("Versículo");
    expect(created.style).toEqual(DEFAULT_PRESET_STYLE);
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it("rechaza nombres vacíos", () => {
    expect(() => createPreset({ name: "   " }, dependencies)).toThrow(PresetNameError);
  });
});

describe("duplicatePreset", () => {
  it("crea una copia independiente con nuevo id, nombre y fechas", () => {
    const original = preset({ style: { ...DEFAULT_PRESET_STYLE, fontSize: 12 } });
    const copy = duplicatePreset(original, dependencies);

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Lyrics Center — copia");
    expect(copy.createdAt).toBe("2026-02-01T10:00:00.000Z");
    expect(copy.style).toEqual(original.style);
    expect(copy.style).not.toBe(original.style);
  });

  it("el preset por defecto puede duplicarse", () => {
    expect(duplicatePreset(DEFAULT_PRESET, dependencies).id).not.toBe(DEFAULT_PRESET_ID);
  });
});

describe("protección del preset por defecto", () => {
  it("no se renombra, no se edita y no se elimina", () => {
    expect(() => renamePreset(DEFAULT_PRESET, "Otro", dependencies.now)).toThrow(DefaultPresetError);
    expect(() => updatePresetStyle(DEFAULT_PRESET, DEFAULT_PRESET_STYLE, dependencies.now)).toThrow(
      DefaultPresetError,
    );
    expect(() => assertDeletable(DEFAULT_PRESET)).toThrow(DefaultPresetError);
  });
});

describe("updatePresetStyle", () => {
  it("normaliza valores fuera de rango y actualiza updatedAt", () => {
    const updated = updatePresetStyle(
      preset(),
      { ...DEFAULT_PRESET_STYLE, fontSize: 999, safeAreaX: -4 },
      dependencies.now,
    );

    expect(updated.style.fontSize).toBeLessThanOrEqual(30);
    expect(updated.style.safeAreaX).toBeGreaterThanOrEqual(0);
    expect(updated.updatedAt).toBe("2026-02-01T10:00:00.000Z");
  });
});

describe("normalizePresetStyle", () => {
  it("datos inválidos caen al estilo por defecto", () => {
    expect(normalizePresetStyle(undefined)).toEqual(DEFAULT_PRESET_STYLE);
    expect(normalizePresetStyle({ fontFamily: "comic", background: "rojo" })).toEqual(
      DEFAULT_PRESET_STYLE,
    );
  });
});

describe("presetStylesEqual", () => {
  it("detecta cambios visuales", () => {
    expect(presetStylesEqual(DEFAULT_PRESET_STYLE, { ...DEFAULT_PRESET_STYLE })).toBe(true);
    expect(presetStylesEqual(DEFAULT_PRESET_STYLE, { ...DEFAULT_PRESET_STYLE, align: "left" })).toBe(
      false,
    );
  });
});

describe("sortPresets y filterPresets", () => {
  it("el Default va primero y el resto por nombre", () => {
    const sorted = sortPresets([preset({ id: "b", name: "Zeta" }), preset({ id: "a", name: "Alfa" }), DEFAULT_PRESET]);

    expect(sorted.map((item) => item.name)).toEqual([DEFAULT_PRESET.name, "Alfa", "Zeta"]);
  });

  it("filtra por nombre sin distinguir mayúsculas", () => {
    expect(filterPresets([preset({ name: "Lyrics Center" })], "lyr")).toHaveLength(1);
    expect(filterPresets([preset({ name: "Lyrics Center" })], "versículo")).toHaveLength(0);
  });
});
