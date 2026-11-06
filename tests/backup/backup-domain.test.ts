import { describe, expect, it } from "bun:test";
import {
  BACKUP_DATA_PATHS,
  BACKUP_MAGIC,
  backupFileName,
  isSafeBackupPath,
} from "@/domain/backup/backup";
import { parseBackupManifest } from "@/domain/backup/backup-schema";
import { BackupMigrationRegistry } from "@/domain/backup/backup-migrations";
import { encodeNdjson, parseNdjson } from "@/services/backup/backup-ndjson";
import { digestStream, sha256Bytes } from "@/services/backup/backup-integrity";

const emptyCounts = {
  projects: 0,
  songs: 0,
  presets: 0,
  mediaAssets: 0,
  mediaCollections: 0,
  mediaFiles: 0,
  bibleVersions: 0,
  bibleBooks: 0,
  bibleChapters: 0,
  preferences: 4,
};

function manifest() {
  return {
    magic: BACKUP_MAGIC,
    formatVersion: 1,
    contentId: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-11-05T12:00:00.000Z",
    appVersion: "Fase 15",
    buildId: "test",
    backupType: "without-media",
    workspace: { kind: "local", id: "local-workspace" },
    source: {
      syncStateExcluded: true,
      hadActiveSyncLink: false,
      pendingSyncOperations: 0,
      conflictCount: 0,
    },
    capabilities: {
      mediaMetadata: true,
      mediaBytes: false,
      bibleContent: true,
      preferencesSchema: 1,
    },
    counts: emptyCounts,
    sizes: { structuredBytes: 0, mediaBytes: 0, totalUncompressedBytes: 0 },
    entries: [],
  };
}

describe("backup format v1", () => {
  it("uses a deterministic safe filename", () => {
    expect(backupFileName(new Date("2026-11-05T12:34:00Z"))).toBe(
      "Presenter-El-Encuentro_Backup_2026-11-05_12-34.presenterbackup",
    );
  });

  it("allows only declared data and ordinal media paths", () => {
    expect(isSafeBackupPath(BACKUP_DATA_PATHS.projects)).toBe(true);
    expect(isSafeBackupPath("media/00000001.bin")).toBe(true);
    expect(isSafeBackupPath("../projects.ndjson")).toBe(false);
    expect(isSafeBackupPath("data/unknown.json")).toBe(false);
    expect(isSafeBackupPath("media/a.bin")).toBe(false);
  });

  it("accepts v1 and rejects future manifests", () => {
    expect(parseBackupManifest(manifest()).formatVersion).toBe(1);
    expect(() => parseBackupManifest({ ...manifest(), formatVersion: 2 })).toThrow("más nuevo");
  });

  it("rejects case-folded duplicate paths", () => {
    const entry = {
      path: "manifest.json",
      type: "json",
      uncompressedSize: 0,
      sha256: "0".repeat(64),
    };
    expect(() =>
      parseBackupManifest({ ...manifest(), entries: [entry, { ...entry, path: "MANIFEST.JSON" }] }),
    ).toThrow();
  });

  it("round-trips bounded NDJSON", () => {
    const bytes = encodeNdjson([{ id: "one" }, { id: "two", text: "línea" }]);
    expect(parseNdjson(bytes, 2)).toEqual([{ id: "one" }, { id: "two", text: "línea" }]);
    expect(() => parseNdjson(bytes, 1)).toThrow("demasiados registros");
  });

  it("hashes bytes and streams with the same SHA-256", async () => {
    const value = new TextEncoder().encode("presenter backup");
    expect((await digestStream(new Blob([value]).stream())).sha256).toBe(sha256Bytes(value));
  });

  it("runs migrations sequentially and rejects missing/future versions", () => {
    const registry = new BackupMigrationRegistry()
      .register(0, (value) => ({ ...(value as object), formatVersion: 1 }))
      .register(1, (value) => ({ ...(value as object), formatVersion: 2 }));
    expect(registry.migrate({ formatVersion: 0 }, 2)).toEqual({ formatVersion: 2 });
    expect(() => new BackupMigrationRegistry().migrate({ formatVersion: 0 }, 1)).toThrow(
      "No existe",
    );
    expect(() => registry.migrate({ formatVersion: 3 }, 2)).toThrow("futuro");
  });
});
