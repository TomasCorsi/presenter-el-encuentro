import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import {
  BACKUP_DATA_PATHS,
  BACKUP_FORMAT_VERSION,
  BACKUP_LIMITS,
  BACKUP_MAGIC,
  BACKUP_MIME,
  type BackupEntryManifest,
  type BackupIntegrityV1,
  type BackupProgress,
  type BackupType,
  type PresenterBackupManifestV1,
} from "@/domain/backup/backup";
import { encodeNdjson } from "./backup-ndjson";
import { hashingTransform, sha256Bytes } from "./backup-integrity";
import { createUuid } from "@/utils/create-id";
import {
  readLocalBackupSnapshot,
  snapshotFingerprint,
  type LocalBackupSnapshot,
} from "./local-backup-snapshot";
import type { MediaFileStorage } from "@/services/media/media-file-storage";

const encoder = new TextEncoder();

export interface BackupExportOptions {
  type: BackupType;
  factory: IDBFactory;
  storage: Storage;
  mediaStorage: MediaFileStorage;
  appVersion: string;
  buildId: string;
  writable?: WritableStream<Uint8Array>;
  signal?: AbortSignal;
  onProgress?: (progress: BackupProgress) => void;
  now?: Date;
}

function structured(snapshot: LocalBackupSnapshot) {
  return [
    [BACKUP_DATA_PATHS.projects, snapshot.projects],
    [BACKUP_DATA_PATHS.songs, snapshot.songs],
    [BACKUP_DATA_PATHS.presets, snapshot.presets],
    [BACKUP_DATA_PATHS.mediaAssets, snapshot.mediaAssets],
    [BACKUP_DATA_PATHS.mediaCollections, snapshot.mediaCollections],
    [BACKUP_DATA_PATHS.bibleVersions, snapshot.bibleVersions],
    [BACKUP_DATA_PATHS.bibleBooks, snapshot.bibleBooks],
    [BACKUP_DATA_PATHS.bibleChapters, snapshot.bibleChapters],
  ] as const;
}

export async function exportLocalBackup(options: BackupExportOptions): Promise<Blob | null> {
  const includeMediaBytes = options.type === "complete";
  options.onProgress?.({
    phase: "inventory",
    completedBytes: 0,
    totalBytes: 0,
    completedItems: 0,
    totalItems: 0,
    message: "Leyendo datos locales…",
  });
  const snapshot = await readLocalBackupSnapshot({
    factory: options.factory,
    storage: options.storage,
    mediaStorage: options.mediaStorage,
    includeMediaBytes,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const initialFingerprint = snapshotFingerprint(snapshot);
  const entries: BackupEntryManifest[] = [];
  const blobWriter = options.writable ? null : new BlobWriter(BACKUP_MIME);
  const writer = new ZipWriter(options.writable ?? blobWriter!, {
    zip64: true,
    keepOrder: true,
    dataDescriptor: true,
    useWebWorkers: true,
  });
  let structuredBytes = 0;
  let mediaBytes = 0;
  let completedItems = 0;
  const totalItems = 9 + snapshot.mediaFiles.size;
  try {
    for (const [path, records] of structured(snapshot)) {
      options.signal?.throwIfAborted();
      const bytes = encodeNdjson(records);
      structuredBytes += bytes.byteLength;
      if (structuredBytes > BACKUP_LIMITS.structuredBytes) {
        throw new Error("Los datos estructurados superan 512 MiB.");
      }
      await writer.add(path, new Uint8ArrayReader(bytes));
      entries.push({
        path,
        type: "ndjson",
        uncompressedSize: bytes.byteLength,
        sha256: sha256Bytes(bytes),
        recordCount: records.length,
      });
      completedItems += 1;
      options.onProgress?.({
        phase: "export",
        completedBytes: structuredBytes + mediaBytes,
        totalBytes:
          structuredBytes + [...snapshot.mediaFiles.values()].reduce((n, b) => n + b.size, 0),
        completedItems,
        totalItems,
        message: `Exportando ${path}…`,
      });
    }

    const preferencesBytes = encoder.encode(JSON.stringify(snapshot.preferences));
    if (preferencesBytes.byteLength > BACKUP_LIMITS.preferencesBytes) {
      throw new Error("Las preferencias superan el límite permitido.");
    }
    structuredBytes += preferencesBytes.byteLength;
    await writer.add(BACKUP_DATA_PATHS.preferences, new Uint8ArrayReader(preferencesBytes));
    entries.push({
      path: BACKUP_DATA_PATHS.preferences,
      type: "json",
      uncompressedSize: preferencesBytes.byteLength,
      sha256: sha256Bytes(preferencesBytes),
      recordCount: 1,
    });
    completedItems += 1;

    let mediaOrdinal = 0;
    for (const asset of snapshot.mediaAssets) {
      const blob = snapshot.mediaFiles.get(asset.id);
      if (!blob) continue;
      options.signal?.throwIfAborted();
      mediaOrdinal += 1;
      const path = `media/${String(mediaOrdinal).padStart(8, "0")}.bin`;
      let digest: { sha256: string; bytes: number } | null = null;
      const stream = blob.stream().pipeThrough(hashingTransform((result) => (digest = result)));
      await writer.add(path, stream, {
        level: 0,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!digest) throw new Error("No se pudo calcular la integridad de Media.");
      const mediaDigest = digest as { sha256: string; bytes: number };
      mediaBytes += mediaDigest.bytes;
      entries.push({
        path,
        type: "media",
        uncompressedSize: mediaDigest.bytes,
        sha256: mediaDigest.sha256,
        mediaId: asset.id,
        mimeType: asset.mimeType,
      });
      completedItems += 1;
      options.onProgress?.({
        phase: "export",
        completedBytes: structuredBytes + mediaBytes,
        totalBytes:
          structuredBytes + [...snapshot.mediaFiles.values()].reduce((n, b) => n + b.size, 0),
        completedItems,
        totalItems,
        message: `Exportando Media ${mediaOrdinal}/${snapshot.mediaFiles.size}…`,
      });
    }

    const manifest: PresenterBackupManifestV1 = {
      magic: BACKUP_MAGIC,
      formatVersion: BACKUP_FORMAT_VERSION,
      contentId: createUuid(),
      createdAt: (options.now ?? new Date()).toISOString(),
      appVersion: options.appVersion,
      buildId: options.buildId,
      backupType: options.type,
      workspace: { kind: "local", id: "local-workspace" },
      source: { syncStateExcluded: true, ...snapshot.syncSummary },
      capabilities: {
        mediaMetadata: true,
        mediaBytes: includeMediaBytes,
        bibleContent: true,
        preferencesSchema: 1,
      },
      counts: {
        projects: snapshot.projects.length,
        songs: snapshot.songs.length,
        presets: snapshot.presets.length,
        mediaAssets: snapshot.mediaAssets.length,
        mediaCollections: snapshot.mediaCollections.length,
        mediaFiles: snapshot.mediaFiles.size,
        bibleVersions: snapshot.bibleVersions.length,
        bibleBooks: snapshot.bibleBooks.length,
        bibleChapters: snapshot.bibleChapters.length,
        preferences: 5,
      },
      sizes: {
        structuredBytes,
        mediaBytes,
        totalUncompressedBytes: structuredBytes + mediaBytes,
      },
      entries,
    };
    const manifestBytes = encoder.encode(JSON.stringify(manifest));
    if (manifestBytes.byteLength > BACKUP_LIMITS.manifestBytes) {
      throw new Error("El manifest supera el límite permitido.");
    }
    const integrity: BackupIntegrityV1 = {
      formatVersion: 1,
      manifestPath: "manifest.json",
      manifestByteLength: manifestBytes.byteLength,
      manifestSha256: sha256Bytes(manifestBytes),
    };
    await writer.add("manifest.json", new Uint8ArrayReader(manifestBytes));
    await writer.add("integrity.json", new TextReader(JSON.stringify(integrity)));

    const finalSnapshot = await readLocalBackupSnapshot({
      factory: options.factory,
      storage: options.storage,
      mediaStorage: options.mediaStorage,
      includeMediaBytes: false,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (snapshotFingerprint(finalSnapshot) !== initialFingerprint) {
      throw new Error("Media o Bible cambió durante la exportación. Repetí el backup.");
    }
    const result = await writer.close();
    options.onProgress?.({
      phase: "complete",
      completedBytes: structuredBytes + mediaBytes,
      totalBytes: structuredBytes + mediaBytes,
      completedItems: totalItems,
      totalItems,
      message: "Backup creado.",
    });
    return options.writable ? null : (result as Blob);
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
  }
}
