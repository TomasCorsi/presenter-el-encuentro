import type { LiveDensity } from "./live-layout";
import type { LibraryTab } from "./components/live-library-dock";

export const LIBRARY_PREFERENCE_KEY = "broadcast-control.live.library";

export interface LibraryPreference {
  open: boolean;
  tab: LibraryTab;
  versionId: string | null;
}

export function defaultLibraryPreference(density: LiveDensity): LibraryPreference {
  return { open: density === "desktop", tab: "songs", versionId: null };
}

export function parseLibraryPreference(
  raw: string | null,
  density: LiveDensity,
): LibraryPreference {
  const fallback = defaultLibraryPreference(density);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<LibraryPreference>;
    return {
      open: typeof parsed.open === "boolean" ? parsed.open : fallback.open,
      tab:
        parsed.tab === "bible" || parsed.tab === "media" || parsed.tab === "backgrounds"
          ? parsed.tab
          : "songs",
      versionId: typeof parsed.versionId === "string" ? parsed.versionId : null,
    };
  } catch {
    return fallback;
  }
}

export function readLibraryPreference(
  storage: Pick<Storage, "getItem">,
  density: LiveDensity,
): LibraryPreference {
  try {
    return parseLibraryPreference(storage.getItem(LIBRARY_PREFERENCE_KEY), density);
  } catch {
    return defaultLibraryPreference(density);
  }
}
