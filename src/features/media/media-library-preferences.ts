export const MEDIA_LIBRARY_PREFERENCES_KEY = "broadcast-control.media.preferences.v1";
export const LEGACY_BACKGROUND_PREFERENCES_KEY = "broadcast-control.live.backgrounds.v1";
export const MAX_RECENT_MEDIA = 30;

export type MediaLibraryViewMode = "grid" | "compact";

export interface MediaLibraryPreferences {
  favoriteIds: string[];
  /** Actividad MRU aproximada; no es un historial de uso. */
  recentIds: string[];
  viewMode: MediaLibraryViewMode;
}

export const DEFAULT_MEDIA_LIBRARY_PREFERENCES: MediaLibraryPreferences = {
  favoriteIds: [],
  recentIds: [],
  viewMode: "grid",
};

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function stringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry !== ""))]
    : [];
}

export function parseMediaLibraryPreferences(raw: string | null): MediaLibraryPreferences {
  if (!raw) return { ...DEFAULT_MEDIA_LIBRARY_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      favoriteIds: stringIds(value["favoriteIds"]),
      recentIds: stringIds(value["recentIds"]).slice(0, MAX_RECENT_MEDIA),
      viewMode: value["viewMode"] === "compact" ? "compact" : "grid",
    };
  } catch {
    return { ...DEFAULT_MEDIA_LIBRARY_PREFERENCES };
  }
}

/** Migra favoritos/recientes del deck sólo cuando la preferencia nueva no existe. */
export function readMediaLibraryPreferences(storage: PreferenceStorage): MediaLibraryPreferences {
  const current = storage.getItem(MEDIA_LIBRARY_PREFERENCES_KEY);
  if (current) return parseMediaLibraryPreferences(current);

  const legacy = parseMediaLibraryPreferences(storage.getItem(LEGACY_BACKGROUND_PREFERENCES_KEY));
  const migrated = { ...legacy, viewMode: "grid" as const };
  storage.setItem(MEDIA_LIBRARY_PREFERENCES_KEY, JSON.stringify(migrated));
  return migrated;
}

export function writeMediaLibraryPreferences(
  storage: PreferenceStorage,
  preferences: MediaLibraryPreferences,
): void {
  storage.setItem(MEDIA_LIBRARY_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function sanitizeMediaLibraryPreferences(
  preferences: MediaLibraryPreferences,
  existingIds: readonly string[],
): MediaLibraryPreferences {
  const existing = new Set(existingIds);
  return {
    ...preferences,
    favoriteIds: preferences.favoriteIds.filter((id) => existing.has(id)),
    recentIds: preferences.recentIds.filter((id) => existing.has(id)),
  };
}

export function setMediaFavorite(
  preferences: MediaLibraryPreferences,
  ids: readonly string[],
  favorite: boolean,
): MediaLibraryPreferences {
  const next = new Set(preferences.favoriteIds);
  for (const id of ids) {
    if (favorite) next.add(id);
    else next.delete(id);
  }
  return { ...preferences, favoriteIds: [...next] };
}

export function toggleMediaFavorite(
  preferences: MediaLibraryPreferences,
  id: string,
): MediaLibraryPreferences {
  return setMediaFavorite(preferences, [id], !preferences.favoriteIds.includes(id));
}

export function recordRecentMedia(
  preferences: MediaLibraryPreferences,
  ids: readonly string[],
): MediaLibraryPreferences {
  const next = [...ids, ...preferences.recentIds.filter((id) => !ids.includes(id))];
  return { ...preferences, recentIds: [...new Set(next)].slice(0, MAX_RECENT_MEDIA) };
}
