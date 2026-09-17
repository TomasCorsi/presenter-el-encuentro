import { describe, expect, it } from "bun:test";

import type { PresentationItem } from "@/domain/presentation/presentation";
import {
  appendPresentationItem,
  createInitialPresentationState,
  loadPresentation,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import { setProgramMode, take } from "@/domain/presentation/presentation-program";

function item(id: string, slideCount: number): PresentationItem {
  return {
    id,
    type: "song",
    title: `Item ${id}`,
    order: 0,
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `${id}:s${index}`,
      itemId: id,
      order: index,
      content: { kind: "text" as const, lines: [`línea ${index}`] },
    })),
  };
}

const show = loadPresentation(createInitialPresentationState(), [item("a", 2), item("b", 2)]);

describe("appendPresentationItem", () => {
  it("añade el item al final sin tocar Preview, Program ni el modo", () => {
    const onAir = setProgramMode(take(selectSlide(show, "a:s1")), "black");
    const state = appendPresentationItem(onAir, item("c", 3));

    expect(state.runtime.items).toHaveLength(3);
    expect(state.runtime.items[2]?.id).toBe("c");
    expect(state.runtime.items[2]?.order).toBe(2);
    expect(state.previewSlideId).toBe("a:s1");
    expect(state.programSlideId).toBe("a:s1");
    expect(state.programMode).toBe("black");
  });

  it("conserva el contenido congelado de los items existentes", () => {
    const state = appendPresentationItem(show, item("c", 1));

    expect(state.runtime.items[0]).toEqual(show.runtime.items[0]!);
    expect(state.runtime.items[1]).toEqual(show.runtime.items[1]!);
  });

  it("deja la nueva slide navegable", () => {
    const state = appendPresentationItem(show, item("c", 1));

    expect(state.runtime.navigableSlideIds).toContain("c:s0");
  });

  it("posiciona Preview cuando el show estaba vacío", () => {
    const state = appendPresentationItem(createInitialPresentationState(), item("c", 2));

    expect(state.previewItemId).toBe("c");
    expect(state.previewSlideId).toBe("c:s0");
    expect(state.programSlideId).toBeNull();
  });

  it("es no-op con un item repetido", () => {
    expect(appendPresentationItem(show, item("a", 2))).toBe(show);
  });
});
