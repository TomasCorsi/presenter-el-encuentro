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
  recordRecentBackground,
  sanitizeBackgroundPreferences,
  toggleBackgroundFavorite,
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
  it("tolera storage invalido, alterna favoritos y mantiene MRU", () => {
    const base = parseBackgroundPreferences("no-json");
    const favorite = toggleBackgroundFavorite(base, "m1");
    expect(favorite.favoriteIds).toEqual(["m1"]);
    expect(toggleBackgroundFavorite(favorite, "m1").favoriteIds).toEqual([]);

    let recent = favorite;
    for (let index = 0; index < 14; index += 1) {
      recent = recordRecentBackground(recent, `m${index}`);
    }
    expect(recent.recentIds).toHaveLength(12);
    expect(recent.recentIds[0]).toBe("m13");
    expect(sanitizeBackgroundPreferences(recent, ["m13", "m12"]).recentIds).toEqual(["m13", "m12"]);
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
