export const LIVE_NARROW_MAX_WIDTH = 1440;
export const LIVE_COMPACT_MAX_HEIGHT = 820;
export const LIVE_SHORT_MAX_HEIGHT = 740;

export type LiveDensity = "desktop" | "compact" | "short";

export interface LiveLayoutProfile {
  width: number;
  height: number;
  narrow: boolean;
  compact: boolean;
  short: boolean;
  density: LiveDensity;
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Clasificación pura del viewport; la altura manda sobre la densidad. */
export function getLiveLayoutProfile(width: number, height: number): LiveLayoutProfile {
  const safeWidth = positiveDimension(width, 1920);
  const safeHeight = positiveDimension(height, 1080);
  const short = safeHeight <= LIVE_SHORT_MAX_HEIGHT;
  const compact = safeHeight <= LIVE_COMPACT_MAX_HEIGHT;

  return {
    width: safeWidth,
    height: safeHeight,
    narrow: safeWidth <= LIVE_NARROW_MAX_WIDTH,
    compact,
    short,
    density: short ? "short" : compact ? "compact" : "desktop",
  };
}

export function appContentOverflowClass(liveRoute: boolean): "overflow-hidden" | "overflow-y-auto" {
  return liveRoute ? "overflow-hidden" : "overflow-y-auto";
}
