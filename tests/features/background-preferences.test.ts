import { describe, expect, it } from "bun:test";

import {
  createInitialPresentationState,
  loadPresentation,
  selectItem,
} from "@/domain/presentation/presentation-engine";
import { take } from "@/domain/presentation/presentation-program";
import type { PresentationItem } from "@/domain/presentation/presentation";
import { getQuickBackgroundTarget } from "@/features/live/background-target";
import {
  parseBackgroundPreferences,
} from "@/features/live/background-preferences";

function item(id: string, type: PresentationItem["type"]): PresentationItem {
  return {
    id,
    type,
    title: id,
    order: 0,
    slides: [{ id: `${id}:s0`, itemId: id, order: 0, content: { kind: "text", lines: [id] } }],
  };
}

describe("Quick Background Deck preferences", () => {
  it("tolera storage inválido y conserva sólo Cut/Fade", () => {
    expect(parseBackgroundPreferences("no-json")).toEqual({ transition: "cut" });
    expect(
      parseBackgroundPreferences(
        JSON.stringify({ favoriteIds: ["m1"], recentIds: ["m2"], transition: "fade" }),
      ),
    ).toEqual({ transition: "fade" });
  });
});

describe("Quick Background Deck target", () => {
  it("prioriza Song/Bible en Preview y cae a Program", () => {
    const loaded = loadPresentation(createInitialPresentationState(), [
      item("song", "song"),
      item("media", "media"),
    ]);
    const onAir = take(loaded);
    expect(getQuickBackgroundTarget(onAir)?.id).toBe("song");

    const mediaPreview = selectItem(onAir, "media");
    expect(getQuickBackgroundTarget(mediaPreview)?.id).toBe("song");
  });

  it("queda deshabilitado sin Song/Bible elegible", () => {
    const loaded = loadPresentation(createInitialPresentationState(), [item("media", "media")]);
    expect(getQuickBackgroundTarget(loaded)).toBeNull();
  });
});
