import { describe, expect, it } from "bun:test";

import {
  LIVE_COMPACT_MAX_HEIGHT,
  LIVE_NARROW_MAX_WIDTH,
  LIVE_SHORT_MAX_HEIGHT,
  appContentOverflowClass,
  getLiveLayoutProfile,
} from "@/features/live/live-layout";
import {
  LIBRARY_DOCK_DEFAULT_HEIGHT,
  LIBRARY_DOCK_MIN_HEIGHT,
  getLibraryDockBounds,
} from "@/features/live/library-dock-height";

describe("Live responsive layout", () => {
  it("classifies the supported desktop and notebook viewports", () => {
    expect(getLiveLayoutProfile(1920, 1080)).toMatchObject({
      narrow: false,
      compact: false,
      short: false,
      density: "desktop",
    });
    expect(getLiveLayoutProfile(1600, 900).density).toBe("desktop");
    expect(getLiveLayoutProfile(1440, 900)).toMatchObject({ narrow: true, density: "desktop" });
    expect(getLiveLayoutProfile(1366, 768)).toMatchObject({
      narrow: true,
      compact: true,
      short: false,
      density: "compact",
    });
    expect(getLiveLayoutProfile(1280, 720)).toMatchObject({
      narrow: true,
      compact: true,
      short: true,
      density: "short",
    });
  });

  it("uses inclusive breakpoint boundaries", () => {
    expect(getLiveLayoutProfile(LIVE_NARROW_MAX_WIDTH, 900).narrow).toBe(true);
    expect(getLiveLayoutProfile(1600, LIVE_COMPACT_MAX_HEIGHT).compact).toBe(true);
    expect(getLiveLayoutProfile(1600, LIVE_SHORT_MAX_HEIGHT).short).toBe(true);
  });

  it("provides the agreed dock default for every density", () => {
    expect(LIBRARY_DOCK_DEFAULT_HEIGHT).toEqual({ desktop: 240, compact: 190, short: 170 });
  });

  it("limits the dock by viewport and actual available height", () => {
    const bounds = getLibraryDockBounds({
      viewportHeight: 768,
      availableHeight: 560,
      density: "compact",
    });
    expect(bounds.max).toBe(292);
    expect(bounds.max).toBeLessThanOrEqual(Math.floor(768 * 0.55));
  });

  it("never creates negative or impossible dock bounds", () => {
    const bounds = getLibraryDockBounds({
      viewportHeight: Number.NaN,
      availableHeight: 20,
      density: "short",
    });
    expect(bounds.min).toBe(LIBRARY_DOCK_MIN_HEIGHT);
    expect(bounds.max).toBe(LIBRARY_DOCK_MIN_HEIGHT);
    expect(bounds.defaultHeight).toBeGreaterThanOrEqual(bounds.min);
  });

  it("locks overflow only for Live", () => {
    expect(appContentOverflowClass(true)).toBe("overflow-hidden");
    expect(appContentOverflowClass(false)).toBe("overflow-y-auto");
  });
});
