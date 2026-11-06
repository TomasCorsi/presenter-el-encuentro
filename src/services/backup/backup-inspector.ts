import {
  BlobReader,
  Uint8ArrayWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from "@zip.js/zip.js";
import {
  BACKUP_DATA_PATHS,
  BACKUP_LIMITS,
  isSafeBackupPath,
  type BackupInspection,
  type BackupPreferences,
  type PresenterBackupManifestV1,
} from "@/domain/backup/backup";
import { backupIntegritySchema, parseBackupManifest } from "@/domain/backup/backup-schema";
import { parseNdjson } from "./backup-ndjson";
import { hashingWritable, sha256Bytes } from "./backup-integrity";
import { hashBlobOffMainThread } from "./backup-worker-client";
import { readStorageEstimate } from "@/services/media/storage-persistence";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import { readLocalBackupSnapshot } from "./local-backup-snapshot";

const decoder = new TextDecoder("utf-8", { fatal: true });

export interface VerifiedBackupPayload {
  manifest: PresenterBackupManifestV1;
  projects: unknown[];
  songs: unknown[];
  presets: unknown[];
  mediaAssets: unknown[];
  mediaCollections: unknown[];
  bibleVersions: unknown[];
  bibleBooks: unknown[];
  bibleChapters: unknown[];
  preferences: BackupPreferences;
  mediaEntries: Map<string, FileEntry>;
}

function entryFlags(entry: Entry): Record<string, unknown> {
  return entry as unknown as Record<string, unknown>;
}

function isFileEntry(entry: Entry): entry is FileEntry {
  return !entry.directory && "getData" in entry;
}

async function entryBytes(entry: FileEntry, maximum: number): Promise<Uint8Array> {
  if (entry.uncompressedSize > maximum)
    throw new Error(`La entrada ${entry.filename} es demasiado grande.`);
  const value = await entry.getData(new Uint8ArrayWriter());
  if (!(value instanceof Uint8Array) || value.byteLength > maximum) {
    throw new Error(`No se pudo leer ${entry.filename} de forma segura.`);
  }
  return value;
}

function validateArchiveEntries(entries: Entry[]): Map<string, FileEntry> {
  if (entries.length > BACKUP_LIMITS.entries)
    throw new Error("El archive contiene demasiadas entradas.");
  const result = new Map<string, FileEntry>();
  const folded = new Set<string>();
  let totalUncompressed = 0;
  let totalCompressed = 0;
  for (const entry of entries) {
    const flags = entryFlags(entry);
    if (!isSafeBackupPath(entry.filename) || !isFileEntry(entry))
      throw new Error("El archive contiene un path no permitido.");
    if (result.has(entry.filename) || folded.has(entry.filename.toLocaleLowerCase("en-US"))) {
      throw new Error("El archive contiene paths duplicados.");
    }
    if (flags["encrypted"] === true) throw new Error("Los backups cifrados no están soportados.");
    if (Number(flags["diskNumberStart"] ?? 0) !== 0)
      throw new Error("Los ZIP multipart no están soportados.");
    totalUncompressed += entry.uncompressedSize;
    totalCompressed += entry.compressedSize;
    if (totalUncompressed > BACKUP_LIMITS.totalBytes)
      throw new Error("El archive supera el tamaño máximo.");
    if (
      entry.uncompressedSize > 64 * 1024 * 1024 &&
      entry.uncompressedSize > Math.max(1, entry.compressedSize) * 1_000
    ) {
      throw new Error("El archive fue rechazado por defensa contra zip bombs.");
    }
    const attributes = Number(flags["externalFileAttributes"] ?? 0);
    if (((attributes >>> 16) & 0o170000) === 0o120000)
      throw new Error("El archive contiene symlinks.");
    result.set(entry.filename, entry);
    folded.add(entry.filename.toLocaleLowerCase("en-US"));
  }
  if (
    totalUncompressed > 64 * 1024 * 1024 &&
    totalUncompressed > Math.max(1, totalCompressed) * 1_000
  ) {
    throw new Error("El archive fue rechazado por defensa contra zip bombs.");
  }
  return result;
}

async function verifyEntry(
  entry: FileEntry,
  expected: { sha256: string; uncompressedSize: number },
) {
  let digest: { sha256: string; bytes: number } | null = null;
  await entry.getData(
    hashingWritable((result) => (digest = result), expected.uncompressedSize),
    { checkSignature: true },
  );
  const result = digest as { sha256: string; bytes: number } | null;
  if (!result || result.bytes !== expected.uncompressedSize || result.sha256 !== expected.sha256) {
    throw new Error(`Checksum inválido en ${entry.filename}.`);
  }
}

export async function readVerifiedBackup(
  file: File,
  signal?: AbortSignal,
): Promise<VerifiedBackupPayload> {
  const reader = new ZipReader(new BlobReader(file), { checkSignature: true });
  try {
    signal?.throwIfAborted();
    const entries = await reader.getEntries();
    const byPath = validateArchiveEntries(entries);
    const manifestEntry = byPath.get("manifest.json");
    const integrityEntry = byPath.get("integrity.json");
    if (!manifestEntry || !integrityEntry) throw new Error("Falta manifest.json o integrity.json.");
    const [manifestBytes, integrityBytes] = await Promise.all([
      entryBytes(manifestEntry, BACKUP_LIMITS.manifestBytes),
      entryBytes(integrityEntry, 64 * 1024),
    ]);
    const integrity = backupIntegritySchema.parse(JSON.parse(decoder.decode(integrityBytes)));
    if (
      integrity.manifestByteLength !== manifestBytes.byteLength ||
      integrity.manifestSha256 !== sha256Bytes(manifestBytes)
    ) {
      throw new Error("La integridad del manifest no coincide.");
    }
    const manifest = parseBackupManifest(JSON.parse(decoder.decode(manifestBytes)));
    const declared = new Set(["manifest.json", "integrity.json"]);
    let structuredTotal = 0;
    const mediaEntries = new Map<string, FileEntry>();
    for (const expected of manifest.entries) {
      signal?.throwIfAborted();
      const entry = byPath.get(expected.path);
      if (!entry) throw new Error(`Falta la entrada ${expected.path}.`);
      declared.add(expected.path);
      if (entry.uncompressedSize !== expected.uncompressedSize) {
        throw new Error(`El tamaño de ${expected.path} no coincide.`);
      }
      if (expected.type === "media") {
        if (!expected.mediaId) throw new Error("Una entrada Media no tiene ID.");
        mediaEntries.set(expected.mediaId, entry);
      } else {
        structuredTotal += expected.uncompressedSize;
      }
      if (structuredTotal > BACKUP_LIMITS.structuredBytes) {
        throw new Error("El contenido estructurado supera 512 MiB.");
      }
      await verifyEntry(entry, expected);
    }
    if ([...byPath.keys()].some((path) => !declared.has(path))) {
      throw new Error("El archive contiene entradas no declaradas.");
    }

    const readRecords = async (path: string, maximum: number) => {
      const expected = manifest.entries.find((item) => item.path === path);
      const entry = byPath.get(path);
      if (!expected || !entry) throw new Error(`Falta ${path}.`);
      const records = parseNdjson(await entryBytes(entry, BACKUP_LIMITS.structuredBytes), maximum);
      if (records.length !== expected.recordCount) throw new Error(`Conteo inválido en ${path}.`);
      return records;
    };
    const preferencesEntry = byPath.get(BACKUP_DATA_PATHS.preferences);
    if (!preferencesEntry) throw new Error("Faltan preferencias.");
    const preferences = JSON.parse(
      decoder.decode(await entryBytes(preferencesEntry, BACKUP_LIMITS.preferencesBytes)),
    ) as BackupPreferences;
    return {
      manifest,
      projects: await readRecords(BACKUP_DATA_PATHS.projects, BACKUP_LIMITS.projects),
      songs: await readRecords(BACKUP_DATA_PATHS.songs, BACKUP_LIMITS.songs),
      presets: await readRecords(BACKUP_DATA_PATHS.presets, BACKUP_LIMITS.presets),
      mediaAssets: await readRecords(BACKUP_DATA_PATHS.mediaAssets, BACKUP_LIMITS.media),
      mediaCollections: await readRecords(
        BACKUP_DATA_PATHS.mediaCollections,
        BACKUP_LIMITS.collections,
      ),
      bibleVersions: await readRecords(
        BACKUP_DATA_PATHS.bibleVersions,
        BACKUP_LIMITS.bibleVersions,
      ),
      bibleBooks: await readRecords(BACKUP_DATA_PATHS.bibleBooks, BACKUP_LIMITS.bibleBooks),
      bibleChapters: await readRecords(
        BACKUP_DATA_PATHS.bibleChapters,
        BACKUP_LIMITS.bibleChapters,
      ),
      preferences,
      mediaEntries,
    };
  } finally {
    await reader.close();
  }
}

export async function inspectLocalBackup(options: {
  file: File;
  factory: IDBFactory;
  storage: Storage;
  mediaStorage: MediaFileStorage;
  signal?: AbortSignal;
}): Promise<BackupInspection> {
  const payload = await readVerifiedBackup(options.file, options.signal);
  const current = await readLocalBackupSnapshot({
    factory: options.factory,
    storage: options.storage,
    mediaStorage: options.mediaStorage,
    includeMediaBytes: false,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const ids = (values: unknown[]) =>
    new Set(
      values.flatMap((value) =>
        value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
          ? [(value as { id: string }).id]
          : [],
      ),
    );
  const countExisting = (incoming: unknown[], existing: unknown[]) => {
    const currentIds = ids(existing);
    return [...ids(incoming)].filter((id) => currentIds.has(id)).length;
  };
  const currentMedia = new Map(current.mediaAssets.map((asset) => [asset.id, asset]));
  let identicalMedia = 0;
  let differentMedia = 0;
  for (const expected of payload.manifest.entries.filter((entry) => entry.type === "media")) {
    if (!expected.mediaId || !currentMedia.has(expected.mediaId)) continue;
    const blob = await options.mediaStorage.get(expected.mediaId);
    if (!blob || blob.size !== expected.uncompressedSize) {
      differentMedia += 1;
      continue;
    }
    const result = await hashBlobOffMainThread(blob, blob.size);
    if (result.sha256 === expected.sha256) identicalMedia += 1;
    else differentMedia += 1;
  }
  const estimate = await readStorageEstimate();
  const rollbackStructured = new TextEncoder().encode(
    JSON.stringify({
      projects: current.projects,
      songs: current.songs,
      presets: current.presets,
      mediaAssets: current.mediaAssets,
      mediaCollections: current.mediaCollections,
      bibleVersions: current.bibleVersions,
      bibleBooks: current.bibleBooks,
      bibleChapters: current.bibleChapters,
    }),
  ).byteLength;
  const base =
    payload.manifest.sizes.mediaBytes + payload.manifest.sizes.structuredBytes + rollbackStructured;
  const requiredAdditionalBytes = base + Math.max(64 * 1024 * 1024, Math.ceil(base * 0.1));
  const available = estimate ? Math.max(0, estimate.quotaBytes - estimate.usageBytes) : null;
  return {
    file: options.file,
    manifest: payload.manifest,
    collisions: {
      existingProjects: countExisting(payload.projects, current.projects),
      existingSongs: countExisting(payload.songs, current.songs),
      existingPresets: countExisting(payload.presets, current.presets),
      existingMedia: countExisting(payload.mediaAssets, current.mediaAssets),
      identicalMedia,
      differentMedia,
    },
    requiredAdditionalBytes,
    quotaAvailableBytes: available,
    quotaSufficient: available === null ? null : available >= requiredAdditionalBytes,
    warnings:
      payload.manifest.backupType === "without-media"
        ? ["Los archivos Media no están incluidos y quedarán como contenido faltante."]
        : [],
  };
}
