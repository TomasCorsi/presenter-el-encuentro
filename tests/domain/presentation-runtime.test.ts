import { describe, expect, it } from "bun:test";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { buildPresentationRuntime } from "@/domain/presentation/presentation-runtime";

function slide(itemId: string, index: number): Slide {
  return {
    id: `${itemId}:s${index}`,
    itemId,
    order: index,
    content: { kind: "text", lines: [`línea ${index}`] },
  };
}

export function item(id: string, slideCount: number, order = 0): PresentationItem {
  return {
    id,
    type: "song",
    title: `Item ${id}`,
    order,
    slides: Array.from({ length: slideCount }, (_, index) => slide(id, index)),
  };
}

describe("buildPresentationRuntime", () => {
  it("indexa items y slides con orden global navegable", () => {
    const runtime = buildPresentationRuntime([item("a", 2), item("b", 1)]);

    expect(runtime.itemIndexById.get("a")).toBe(0);
    expect(runtime.itemIndexById.get("b")).toBe(1);
    expect([...runtime.navigableSlideIds]).toEqual(["a:s0", "a:s1", "b:s0"]);
    expect(runtime.slideLocationById.get("b:s0")).toEqual({
      itemIndex: 1,
      slideIndex: 0,
      navigableIndex: 2,
    });
  });

  it("incluye items vacíos en el índice pero no en las slides navegables", () => {
    const runtime = buildPresentationRuntime([item("a", 1), item("vacio", 0), item("b", 1)]);

    expect(runtime.itemIndexById.get("vacio")).toBe(1);
    expect([...runtime.navigableSlideIds]).toEqual(["a:s0", "b:s0"]);
  });

  it("normaliza el orden de items y slides", () => {
    const runtime = buildPresentationRuntime([item("a", 2, 7), item("b", 1, 3)]);

    expect(runtime.items.map((entry) => entry.order)).toEqual([0, 1]);
    expect(runtime.items[0]?.slides.map((entry) => entry.order)).toEqual([0, 1]);
  });

  it("descarta items con id duplicado para no producir posiciones ambiguas", () => {
    const runtime = buildPresentationRuntime([item("a", 1), item("a", 2)]);

    expect(runtime.items).toHaveLength(1);
    expect(runtime.navigableSlideIds).toHaveLength(1);
  });

  it("produce un runtime vacío sin items", () => {
    const runtime = buildPresentationRuntime([]);

    expect(runtime.items).toHaveLength(0);
    expect(runtime.navigableSlideIds).toHaveLength(0);
  });
});
