import { describe, expect, it } from "bun:test";

import type { PresentationItem } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
  replacePresentationItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import { setProgramMode, take } from "@/domain/presentation/presentation-program";

function item(id: string, color: string): PresentationItem {
  return {
    id,
    type: "song",
    title: id,
    order: 0,
    slides: [
      {
        id: `${id}:s0`,
        itemId: id,
        order: 0,
        content: { kind: "text", lines: [id] },
        background: { type: "solid", color },
      },
    ],
  };
}

describe("replacePresentationItem", () => {
  it("reemplaza solo un item y conserva Preview, Program y Black", () => {
    const loaded = loadPresentation(createInitialPresentationState(), [
      item("a", "#111111"),
      item("b", "#222222"),
    ]);
    const onAir = setProgramMode(take(selectSlide(loaded, "a:s0")), "black");
    const next = replacePresentationItem(onAir, item("a", "#abcdef"));

    expect(next.runtime.items[0]?.slides[0]?.background).toEqual({
      type: "solid",
      color: "#abcdef",
    });
    expect(next.runtime.items[1]).toBe(onAir.runtime.items[1]);
    expect(next.previewSlideId).toBe("a:s0");
    expect(next.programSlideId).toBe("a:s0");
    expect(next.programMode).toBe("black");
  });

  it("es no-op si el item no pertenece al runtime", () => {
    const loaded = loadPresentation(createInitialPresentationState(), [item("a", "#111111")]);
    expect(replacePresentationItem(loaded, item("x", "#ffffff"))).toBe(loaded);
  });
});
