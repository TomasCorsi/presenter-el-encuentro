import type { LiveDensity } from "./live-layout";

export const LIBRARY_DOCK_HEIGHT_KEY = "broadcast-control.live.library-dock-height.v1";
export const LIBRARY_DOCK_MIN_HEIGHT = 160;
export const LIBRARY_DOCK_MAX_VIEWPORT_RATIO = 0.55;
export const LIBRARY_DOCK_REGION_GAP = 8;

export const LIBRARY_DOCK_DEFAULT_HEIGHT: Record<LiveDensity, number> = {
  desktop: 240,
  compact: 190,
  short: 170,
};

export const LIVE_WORKSPACE_MIN_HEIGHT: Record<LiveDensity, number> = {
  desktop: 300,
  compact: 260,
  short: 240,
};

export interface LibraryDockBoundsInput {
  viewportHeight: number;
  /** Altura real compartida por workspace + gap + dock. */
  availableHeight?: number | null;
  density: LiveDensity;
}

export interface LibraryDockBounds {
  min: number;
  max: number;
  defaultHeight: number;
}

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function safePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getLibraryDockBounds({
  viewportHeight,
  availableHeight,
  density,
}: LibraryDockBoundsInput): LibraryDockBounds {
  const safeViewport = safePositive(viewportHeight, 768);
  const viewportMax = Math.floor(safeViewport * LIBRARY_DOCK_MAX_VIEWPORT_RATIO);
  const availableMax =
    availableHeight === null || availableHeight === undefined
      ? viewportMax
      : Math.floor(
          safePositive(availableHeight, safeViewport) -
            LIVE_WORKSPACE_MIN_HEIGHT[density] -
            LIBRARY_DOCK_REGION_GAP,
        );

  return {
    min: LIBRARY_DOCK_MIN_HEIGHT,
    max: Math.max(LIBRARY_DOCK_MIN_HEIGHT, Math.min(viewportMax, availableMax)),
    defaultHeight: LIBRARY_DOCK_DEFAULT_HEIGHT[density],
  };
}

export function clampLibraryDockHeight(height: number, bounds: LibraryDockBounds): number {
  const safeHeight = Number.isFinite(height) ? height : bounds.defaultHeight;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(safeHeight)));
}

/** Lee la preferencia sin aplicarle el máximo transitorio del viewport. */
export function parseLibraryDockPreference(raw: string | null, defaultHeight: number): number {
  if (raw === null || raw.trim() === "") return defaultHeight;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? Math.max(LIBRARY_DOCK_MIN_HEIGHT, Math.round(parsed))
    : defaultHeight;
}

export function readLibraryDockPreference(storage: StorageReader, defaultHeight: number): number {
  try {
    return parseLibraryDockPreference(storage.getItem(LIBRARY_DOCK_HEIGHT_KEY), defaultHeight);
  } catch {
    return defaultHeight;
  }
}

export function persistLibraryDockPreference(storage: StorageWriter, height: number): number {
  const preferred = Number.isFinite(height)
    ? Math.max(LIBRARY_DOCK_MIN_HEIGHT, Math.round(height))
    : LIBRARY_DOCK_DEFAULT_HEIGHT.desktop;
  try {
    storage.setItem(LIBRARY_DOCK_HEIGHT_KEY, String(preferred));
  } catch {
    // La preferencia no debe bloquear Live si localStorage no está disponible.
  }
  return preferred;
}

/** Arrastrar hacia arriba aumenta la altura; hacia abajo la reduce. */
export function libraryDockHeightFromDrag(
  startHeight: number,
  startClientY: number,
  clientY: number,
  bounds: LibraryDockBounds,
): number {
  return clampLibraryDockHeight(startHeight + startClientY - clientY, bounds);
}
