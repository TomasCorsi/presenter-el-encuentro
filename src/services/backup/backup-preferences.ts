import type { BackupPreferences } from "@/domain/backup/backup";
import {
  BACKGROUND_PREFERENCES_KEY,
  parseBackgroundPreferences,
} from "@/features/live/background-preferences";
import {
  LIBRARY_DOCK_HEIGHT_KEY,
  parseLibraryDockPreference,
} from "@/features/live/library-dock-height";
import { LIBRARY_PREFERENCE_KEY, parseLibraryPreference } from "@/features/live/library-preference";
import {
  MEDIA_LIBRARY_PREFERENCES_KEY,
  parseMediaLibraryPreferences,
  sanitizeMediaLibraryPreferences,
} from "@/features/media/media-library-preferences";

export const BACKUP_PREFERENCE_KEYS = [
  MEDIA_LIBRARY_PREFERENCES_KEY,
  LIBRARY_PREFERENCE_KEY,
  LIBRARY_DOCK_HEIGHT_KEY,
  BACKGROUND_PREFERENCES_KEY,
] as const;

export const LAST_BACKUP_KEY = "broadcast-control.backup.last-success.v1";
export const MAINTENANCE_LEASE_KEY = "broadcast-control.maintenance.lease.v1";

export function restoreBackupPreferences(options: {
  storage: Storage;
  preferences: BackupPreferences;
  mediaIds: readonly string[];
  bibleVersionIds: readonly string[];
}): void {
  const media = sanitizeMediaLibraryPreferences(
    parseMediaLibraryPreferences(JSON.stringify(options.preferences.mediaLibrary)),
    options.mediaIds,
  );
  const library = parseLibraryPreference(
    JSON.stringify(options.preferences.liveLibrary),
    "desktop",
  );
  if (library.versionId && !options.bibleVersionIds.includes(library.versionId)) {
    library.versionId = null;
  }
  options.storage.setItem(MEDIA_LIBRARY_PREFERENCES_KEY, JSON.stringify(media));
  options.storage.setItem(LIBRARY_PREFERENCE_KEY, JSON.stringify(library));
  options.storage.setItem(
    LIBRARY_DOCK_HEIGHT_KEY,
    String(parseLibraryDockPreference(String(options.preferences.liveDockHeight ?? ""), 240)),
  );
  options.storage.setItem(
    BACKGROUND_PREFERENCES_KEY,
    JSON.stringify(parseBackgroundPreferences(JSON.stringify(options.preferences.liveBackgrounds))),
  );
}
