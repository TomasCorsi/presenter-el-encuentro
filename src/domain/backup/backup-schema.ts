import { z } from "zod";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_LIMITS,
  BACKUP_MAGIC,
  isSafeBackupPath,
  type BackupIntegrityV1,
  type PresenterBackupManifestV1,
} from "./backup";

const finiteNonNegative = z.number().finite().nonnegative().max(BACKUP_LIMITS.totalBytes);
const countsSchema = z.object({
  projects: z.number().int().nonnegative().max(BACKUP_LIMITS.projects),
  songs: z.number().int().nonnegative().max(BACKUP_LIMITS.songs),
  presets: z.number().int().nonnegative().max(BACKUP_LIMITS.presets),
  mediaAssets: z.number().int().nonnegative().max(BACKUP_LIMITS.media),
  mediaCollections: z.number().int().nonnegative().max(BACKUP_LIMITS.collections),
  mediaFiles: z.number().int().nonnegative().max(BACKUP_LIMITS.media),
  bibleVersions: z.number().int().nonnegative().max(BACKUP_LIMITS.bibleVersions),
  bibleBooks: z.number().int().nonnegative().max(BACKUP_LIMITS.bibleBooks),
  bibleChapters: z.number().int().nonnegative().max(BACKUP_LIMITS.bibleChapters),
  preferences: z.number().int().nonnegative().max(5),
});
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const entrySchema = z.object({
  path: z.string().refine(isSafeBackupPath, "Path de backup inválido."),
  type: z.enum(["ndjson", "json", "media"]),
  uncompressedSize: finiteNonNegative,
  sha256: hashSchema,
  recordCount: z.number().int().nonnegative().optional(),
  mediaId: z.string().min(1).max(256).optional(),
  mimeType: z.string().min(1).max(128).optional(),
});

export const backupManifestV1Schema = z
  .object({
    magic: z.literal(BACKUP_MAGIC),
    formatVersion: z.literal(BACKUP_FORMAT_VERSION),
    contentId: z.string().uuid(),
    createdAt: z.string().datetime(),
    appVersion: z.string().min(1).max(100),
    buildId: z.string().min(1).max(200),
    backupType: z.enum(["complete", "without-media"]),
    workspace: z.object({ kind: z.literal("local"), id: z.literal("local-workspace") }),
    source: z.object({
      syncStateExcluded: z.literal(true),
      hadActiveSyncLink: z.boolean(),
      pendingSyncOperations: z.number().int().nonnegative(),
      conflictCount: z.number().int().nonnegative(),
    }),
    capabilities: z.object({
      mediaMetadata: z.literal(true),
      mediaBytes: z.boolean(),
      bibleContent: z.literal(true),
      preferencesSchema: z.literal(1),
    }),
    counts: countsSchema,
    sizes: z.object({
      structuredBytes: finiteNonNegative.max(BACKUP_LIMITS.structuredBytes),
      mediaBytes: finiteNonNegative,
      totalUncompressedBytes: finiteNonNegative,
    }),
    entries: z.array(entrySchema).max(BACKUP_LIMITS.entries),
  })
  .superRefine((manifest, context) => {
    const paths = new Set<string>();
    const folded = new Set<string>();
    for (const entry of manifest.entries) {
      const lower = entry.path.toLocaleLowerCase("en-US");
      if (paths.has(entry.path) || folded.has(lower)) {
        context.addIssue({ code: "custom", message: "El backup contiene paths duplicados." });
      }
      paths.add(entry.path);
      folded.add(lower);
      if (entry.type === "media" && (!entry.mediaId || !entry.mimeType)) {
        context.addIssue({ code: "custom", message: "Una entrada Media está incompleta." });
      }
    }
    if (manifest.backupType === "without-media" && manifest.counts.mediaFiles !== 0) {
      context.addIssue({ code: "custom", message: "El backup sin Media declara archivos Media." });
    }
  });

export const backupIntegritySchema: z.ZodType<BackupIntegrityV1> = z.object({
  formatVersion: z.literal(1),
  manifestPath: z.literal("manifest.json"),
  manifestByteLength: z.number().int().nonnegative().max(BACKUP_LIMITS.manifestBytes),
  manifestSha256: hashSchema,
});

export function parseBackupManifest(value: unknown): PresenterBackupManifestV1 {
  const candidate = value as { formatVersion?: unknown };
  if (typeof candidate?.formatVersion === "number" && candidate.formatVersion > 1) {
    throw new Error(
      `El backup usa formatVersion ${candidate.formatVersion}, más nuevo que esta aplicación.`,
    );
  }
  return backupManifestV1Schema.parse(value) as PresenterBackupManifestV1;
}
