import { describe, expect, it } from "bun:test";

import { DEFAULT_PRESET, DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";
import { findPresetUsage, resolvePreset } from "@/domain/presets/preset-resolution";
import { resolveSlideRenderStyle } from "@/domain/presets/resolve-slide-render-style";
import type { Project } from "@/domain/projects/project";

function preset(id: string): Preset {
  return {
    id,
    workspaceId: "local-workspace",
    name: `Preset ${id}`,
    style: { ...DEFAULT_PRESET_STYLE, fontSize: 12 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function project(id: string, name: string, presetIds: (string | undefined)[]): Project {
  return {
    id,
    workspaceId: "local-workspace",
    name,
    rundown: presetIds.map((presetId, index) => ({
      id: `${id}-item-${index}`,
      type: "song" as const,
      title: "Canción",
      sourceId: "song-a",
      order: index,
      ...(presetId === undefined ? {} : { presetId }),
    })),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("resolvePreset", () => {
  it("devuelve el preset asignado", () => {
    expect(resolvePreset("p-a", [preset("p-a")]).id).toBe("p-a");
  });

  it("cae al Default sin id o con id inexistente", () => {
    expect(resolvePreset(undefined, [preset("p-a")])).toEqual(DEFAULT_PRESET);
    expect(resolvePreset("borrado", [preset("p-a")])).toEqual(DEFAULT_PRESET);
  });
});

describe("findPresetUsage", () => {
  it("cuenta apariciones y proyectos afectados", () => {
    const usage = findPresetUsage(
      [project("p1", "Domingo", ["p-a", undefined, "p-a"]), project("p2", "Cierre", ["p-b"])],
      "p-a",
    );

    expect(usage.occurrences).toBe(2);
    expect(usage.projectNames).toEqual(["Domingo"]);
  });
});

describe("resolveSlideRenderStyle", () => {
  it("convierte el tamaño y la safe area a unidades relativas al lienzo", () => {
    const resolved = resolveSlideRenderStyle({
      ...DEFAULT_PRESET_STYLE,
      fontSize: 9,
      safeAreaX: 6,
      safeAreaY: 4,
    });

    expect(resolved.fontSize).toBe("9cqh");
    expect(resolved.paddingInline).toBe("6cqw");
    expect(resolved.paddingBlock).toBe("4cqh");
  });

  it("traduce las alineaciones a ejes flex", () => {
    const bottomRight = resolveSlideRenderStyle({
      ...DEFAULT_PRESET_STYLE,
      align: "right",
      verticalAlign: "bottom",
    });

    expect(bottomRight.textAlign).toBe("right");
    expect(bottomRight.alignItems).toBe("flex-end");
    expect(bottomRight.justifyContent).toBe("flex-end");
  });

  it("usa el color de fondo sólido y el color de texto del preset", () => {
    const resolved = resolveSlideRenderStyle({
      ...DEFAULT_PRESET_STYLE,
      textColor: "#FF0000",
      background: { type: "solid", color: "#001122" },
    });

    expect(resolved.color).toBe("#FF0000");
    expect(resolved.background).toBe("#001122");
  });

  it("sin estilo cae al Default en lugar de romper la salida", () => {
    expect(resolveSlideRenderStyle(undefined)).toEqual(
      resolveSlideRenderStyle(DEFAULT_PRESET_STYLE),
    );
  });
});
