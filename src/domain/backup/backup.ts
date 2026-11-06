export const BACKUP_MAGIC = "presenter-el-encuentro-backup" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_MIME = "application/vnd.presenter-el-encuentro.backup+zip";
export const BACKUP_EXTENSION = ".presenterbackup";

export const BACKUP_LIMITS = {
  manifestBytes: 16 * 1024 * 1024,
  preferencesBytes: 256 * 1024,
  structuredBytes: 512 * 1024 * 1024,
  recordBytes: 16 * 1024 * 1024,
  entries: 50_032,
  media: 50_000,
  projects: 50_000,
  songs: 100_000,
  presets: 10_000,
  collections: 10_000,
  bibleVersions: 100,
  bibleBooks: 10_000,
  bibleChapters: 100_000,
  totalBytes: 8 * 1024 ** 4,
  blobFallbackBytes: 512 * 1024 * 1024,
} as const;

export const BACKUP_DATA_PATHS = {
  projects: "data/projects.ndjson",
  songs: "data/songs.ndjson",
  presets: "data/presets.ndjson",
  mediaAssets: "data/media-assets.ndjson",
  mediaCollections: "data/media-collections.ndjson",
  bibleVersions: "data/bible-versions.ndjson",
  bibleBooks: "data/bible-books.ndjson",
  bibleChapters: "data/bible-chapters.ndjson",
  preferences: "data/preferences.json",
} as const;

export type BackupType = "complete" | "without-media";
export type BackupEntryType = "ndjson" | "json" | "media";
export type BackupProgressPhase =
  "inventory" | "verify" | "export" | "inspect" | "stage" | "commit" | "rollback" | "complete";

export interface BackupProgress {
  phase: BackupProgressPhase;
  completedBytes: number;
  totalBytes: number;
  completedItems: number;
  totalItems: number;
  message: string;
}

export interface BackupCounts {
  projects: number;
  songs: number;
  presets: number;
  mediaAssets: number;
  mediaCollections: number;
  mediaFiles: number;
  bibleVersions: number;
  bibleBooks: number;
  bibleChapters: number;
  preferences: number;
}

export interface BackupEntryManifest {
  path: string;
  type: BackupEntryType;
  uncompressedSize: number;
  sha256: string;
  recordCount?: number;
  mediaId?: string;
  mimeType?: string;
}

export interface PresenterBackupManifestV1 {
  magic: typeof BACKUP_MAGIC;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  contentId: string;
  createdAt: string;
  appVersion: string;
  buildId: string;
  backupType: BackupType;
  workspace: { kind: "local"; id: "local-workspace" };
  source: {
    syncStateExcluded: true;
    hadActiveSyncLink: boolean;
    pendingSyncOperations: number;
    conflictCount: number;
  };
  capabilities: {
    mediaMetadata: true;
    mediaBytes: boolean;
    bibleContent: true;
    preferencesSchema: 1;
  };
  counts: BackupCounts;
  sizes: {
    structuredBytes: number;
    mediaBytes: number;
    totalUncompressedBytes: number;
  };
  entries: BackupEntryManifest[];
}

export interface BackupIntegrityV1 {
  formatVersion: 1;
  manifestPath: "manifest.json";
  manifestByteLength: number;
  manifestSha256: string;
}

export interface BackupPreferences {
  mediaLibrary: unknown;
  liveLibrary: unknown;
  liveDockHeight: unknown;
  liveBackgrounds: unknown;
  activeProjectId: string | null;
}

export interface BackupInventory {
  counts: BackupCounts;
  mediaBytes: number;
  structuredBytes: number;
  estimatedBytes: number;
  missingMediaIds: string[];
}

export interface BackupCollisionSummary {
  existingProjects: number;
  existingSongs: number;
  existingPresets: number;
  existingMedia: number;
  identicalMedia: number;
  differentMedia: number;
}

export interface BackupInspection {
  file: File;
  manifest: PresenterBackupManifestV1;
  collisions: BackupCollisionSummary;
  requiredAdditionalBytes: number;
  quotaAvailableBytes: number | null;
  quotaSufficient: boolean | null;
  warnings: string[];
}

export function backupFileName(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "-");
  return `Presenter-El-Encuentro_Backup_${date}_${time}${BACKUP_EXTENSION}`;
}

export function isSafeBackupPath(path: string): boolean {
  if (!path || path.length > 160 || path.startsWith("/") || path.includes("\\")) return false;
  if (path.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  if (path === "manifest.json" || path === "integrity.json") return true;
  if ((Object.values(BACKUP_DATA_PATHS) as string[]).includes(path)) return true;
  return /^media\/[0-9]{8}\.bin$/.test(path);
}
