import type { BackgroundTransition } from "@/domain/output/output-snapshot";

export const BACKGROUND_PREFERENCES_KEY = "broadcast-control.live.backgrounds.v1";
export const MAX_RECENT_BACKGROUNDS = 12;

export interface BackgroundPreferences {
  favoriteIds: string[];
  recentIds: string[];
  transition: BackgroundTransition;
}

export const DEFAULT_BACKGROUND_PREFERENCES: BackgroundPreferences = {
  favoriteIds: [],
  recentIds: [],
  transition: "cut",
};

function stringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((entry): entry is string => typeof entry === "string" && entry !== ""),
        ),
      ]
    : [];
}

export function parseBackgroundPreferences(raw: string | null): BackgroundPreferences {
  if (!raw) return { ...DEFAULT_BACKGROUND_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      favoriteIds: stringIds(value["favoriteIds"]),
      recentIds: stringIds(value["recentIds"]).slice(0, MAX_RECENT_BACKGROUNDS),
      transition: value["transition"] === "fade" ? "fade" : "cut",
    };
  } catch {
    return { ...DEFAULT_BACKGROUND_PREFERENCES };
  }
}

export function sanitizeBackgroundPreferences(
  preferences: BackgroundPreferences,
  existingIds: readonly string[],
): BackgroundPreferences {
  const existing = new Set(existingIds);
  return {
    ...preferences,
    favoriteIds: preferences.favoriteIds.filter((id) => existing.has(id)),
    recentIds: preferences.recentIds.filter((id) => existing.has(id)),
  };
}

export function toggleBackgroundFavorite(
  preferences: BackgroundPreferences,
  mediaId: string,
): BackgroundPreferences {
  const favoriteIds = preferences.favoriteIds.includes(mediaId)
    ? preferences.favoriteIds.filter((id) => id !== mediaId)
    : [...preferences.favoriteIds, mediaId];
  return { ...preferences, favoriteIds };
}

export function recordRecentBackground(
  preferences: BackgroundPreferences,
  mediaId: string,
): BackgroundPreferences {
  return {
    ...preferences,
    recentIds: [mediaId, ...preferences.recentIds.filter((id) => id !== mediaId)].slice(
      0,
      MAX_RECENT_BACKGROUNDS,
    ),
  };
}
