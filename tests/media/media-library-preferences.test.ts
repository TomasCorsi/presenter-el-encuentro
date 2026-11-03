import { describe, expect, it } from "bun:test";

import {
  MEDIA_LIBRARY_PREFERENCES_KEY,
  readMediaLibraryPreferences,
  recordRecentMedia,
  sanitizeMediaLibraryPreferences,
  setMediaFavorite,
} from "@/features/media/media-library-preferences";

function storage(values: Record<string, string> = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    data,
  };
}

describe("Media Library preferences", () => {
  it("migra favoritos y recientes legacy sin mezclar Cut/Fade", () => {
    const memory = storage({
      "broadcast-control.live.backgrounds.v1": JSON.stringify({
        favoriteIds: ["a"],
        recentIds: ["b", "a"],
        transition: "fade",
      }),
    });
    expect(readMediaLibraryPreferences(memory)).toEqual({
      favoriteIds: ["a"],
      recentIds: ["b", "a"],
      viewMode: "grid",
    });
    expect(memory.data.has(MEDIA_LIBRARY_PREFERENCES_KEY)).toBe(true);
  });

  it("mantiene favoritos, sanea IDs y limita la actividad MRU", () => {
    let preferences = { favoriteIds: [], recentIds: [], viewMode: "compact" as const };
    preferences = setMediaFavorite(preferences, ["a", "b"], true);
    for (let index = 0; index < 35; index += 1) {
      preferences = recordRecentMedia(preferences, [`m${index}`]);
    }
    expect(preferences.recentIds).toHaveLength(30);
    expect(preferences.recentIds[0]).toBe("m34");
    expect(sanitizeMediaLibraryPreferences(preferences, ["a", "m34"])).toEqual({
      favoriteIds: ["a"],
      recentIds: ["m34"],
      viewMode: "compact",
    });
  });
});
