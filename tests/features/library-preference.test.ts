import { describe, expect, it } from "bun:test";

import {
  LIBRARY_PREFERENCE_KEY,
  defaultLibraryPreference,
  readLibraryPreference,
} from "@/features/live/library-preference";

function memoryStorage(raw: string | null) {
  return {
    getItem(key: string) {
      return key === LIBRARY_PREFERENCE_KEY ? raw : null;
    },
  };
}

describe("Live library preference", () => {
  it("starts open on desktop and header-only on compact and short layouts", () => {
    expect(defaultLibraryPreference("desktop").open).toBe(true);
    expect(defaultLibraryPreference("compact").open).toBe(false);
    expect(defaultLibraryPreference("short").open).toBe(false);
  });

  it("preserves an explicit local open preference on compact layouts", () => {
    const preference = readLibraryPreference(
      memoryStorage(JSON.stringify({ open: true, tab: "backgrounds", versionId: "nvi" })),
      "compact",
    );

    expect(preference).toEqual({ open: true, tab: "backgrounds", versionId: "nvi" });
  });

  it("uses the responsive default when no preference exists", () => {
    expect(readLibraryPreference(memoryStorage(null), "compact").open).toBe(false);
    expect(readLibraryPreference(memoryStorage(null), "desktop").open).toBe(true);
  });
});
