import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type {
  BackupInspection,
  BackupInventory,
  BackupProgress,
  BackupType,
} from "@/domain/backup/backup";
import { BACKUP_LIMITS, BACKUP_MIME, backupFileName } from "@/domain/backup/backup";
import { useCloud } from "@/features/cloud/cloud-context";
import { useMedia } from "@/features/media/media-context";
import { useSync } from "@/features/sync/sync-context";
import { exportLocalBackup } from "@/services/backup/backup-exporter";
import { inspectLocalBackup } from "@/services/backup/backup-inspector";
import { restoreLocalBackup } from "@/services/backup/backup-restorer";
import { LAST_BACKUP_KEY } from "@/services/backup/backup-preferences";
import {
  acquireMaintenanceLease,
  assertMaintenanceWindowSafety,
} from "@/services/backup/local-maintenance-coordinator";
import { readLocalBackupSnapshot } from "@/services/backup/local-backup-snapshot";
import { createBrowserMediaStorageGenerationManager } from "@/services/media/media-storage-generations";

interface SaveFileHandle {
  createWritable(): Promise<
    WritableStream<Uint8Array> & { abort?(reason?: unknown): Promise<void> }
  >;
}

interface BackupRuntimeValue {
  busy: boolean;
  progress: BackupProgress | null;
  error: string | null;
  inspection: BackupInspection | null;
  lastBackupAt: string | null;
  inventory: BackupInventory | null;
  refreshInventory(): Promise<void>;
  createBackup(type: BackupType): Promise<void>;
  inspect(file: File): Promise<void>;
  restore(): Promise<void>;
  clearInspection(): void;
  cancel(): void;
}

const BackupContext = createContext<BackupRuntimeValue | null>(null);

export function BackupProvider({ children }: { children: ReactNode }) {
  const media = useMedia();
  const sync = useSync();
  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState(() =>
    typeof localStorage === "undefined" ? null : localStorage.getItem(LAST_BACKUP_KEY),
  );
  const [inventory, setInventory] = useState<BackupInventory | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const readInventory = async (signal?: AbortSignal): Promise<BackupInventory> => {
    const snapshot = await readLocalBackupSnapshot({
      factory: indexedDB,
      storage: localStorage,
      mediaStorage: media.fileStorage,
      includeMediaBytes: false,
      ...(signal ? { signal } : {}),
    });
    const structuredBytes = new TextEncoder().encode(
      JSON.stringify({
        projects: snapshot.projects,
        songs: snapshot.songs,
        presets: snapshot.presets,
        mediaAssets: snapshot.mediaAssets,
        mediaCollections: snapshot.mediaCollections,
        bibleVersions: snapshot.bibleVersions,
        bibleBooks: snapshot.bibleBooks,
        bibleChapters: snapshot.bibleChapters,
        preferences: snapshot.preferences,
      }),
    ).byteLength;
    const missingMediaIds: string[] = [];
    for (const asset of snapshot.mediaAssets) {
      signal?.throwIfAborted();
      if (!(await media.fileStorage.exists(asset.id))) missingMediaIds.push(asset.id);
    }
    const mediaBytes = snapshot.mediaAssets.reduce((total, asset) => total + asset.sizeBytes, 0);
    return {
      counts: {
        projects: snapshot.projects.length,
        songs: snapshot.songs.length,
        presets: snapshot.presets.length,
        mediaAssets: snapshot.mediaAssets.length,
        mediaCollections: snapshot.mediaCollections.length,
        mediaFiles: snapshot.mediaAssets.length - missingMediaIds.length,
        bibleVersions: snapshot.bibleVersions.length,
        bibleBooks: snapshot.bibleBooks.length,
        bibleChapters: snapshot.bibleChapters.length,
        preferences: 5,
      },
      mediaBytes,
      structuredBytes,
      estimatedBytes: structuredBytes + mediaBytes,
      missingMediaIds,
    };
  };

  const runMaintenance = async (
    operation: "backup-complete" | "backup-light" | "restore",
    action: (signal: AbortSignal) => Promise<void>,
  ) => {
    setBusy(true);
    setError(null);
    let releaseLease: (() => void) | null = null;
    let releaseSync: (() => void) | null = null;
    try {
      await assertMaintenanceWindowSafety(operation);
      releaseLease = await acquireMaintenanceLease(
        localStorage,
        operation === "restore" ? "restore" : "backup",
      );
      releaseSync = await sync.beginMaintenance();
      const controller = new AbortController();
      abortRef.current = controller;
      await action(controller.signal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La operación de backup falló.");
      throw reason;
    } finally {
      releaseSync?.();
      releaseLease?.();
      abortRef.current = null;
      setBusy(false);
    }
  };

  const value: BackupRuntimeValue = {
    busy,
    progress,
    error,
    inspection,
    lastBackupAt,
    inventory,
    refreshInventory: async () => setInventory(await readInventory()),
    createBackup: async (type) => {
      await runMaintenance(
        type === "complete" ? "backup-complete" : "backup-light",
        async (signal) => {
          const nextInventory = await readInventory(signal);
          setInventory(nextInventory);
          const estimatedBytes =
            type === "complete" ? nextInventory.estimatedBytes : nextInventory.structuredBytes;
          const picker = (
            window as typeof window & {
              showSaveFilePicker?: (options: unknown) => Promise<SaveFileHandle>;
            }
          ).showSaveFilePicker;
          let writable: WritableStream<Uint8Array> | undefined;
          if (picker) {
            const handle = await picker({
              suggestedName: backupFileName(),
              types: [
                {
                  description: "Presenter Backup",
                  accept: { [BACKUP_MIME]: [".presenterbackup"] },
                },
              ],
            });
            writable = await handle.createWritable();
          } else if (estimatedBytes > BACKUP_LIMITS.blobFallbackBytes) {
            throw new Error("Este backup supera 512 MiB y requiere File System Access API.");
          }
          const blob = await exportLocalBackup({
            type,
            factory: indexedDB,
            storage: localStorage,
            mediaStorage: media.fileStorage,
            appVersion: typeof __APP_VERSION__ === "undefined" ? "Fase 15" : __APP_VERSION__,
            buildId: typeof __APP_BUILD_ID__ === "undefined" ? "development" : __APP_BUILD_ID__,
            ...(writable ? { writable } : {}),
            onProgress: setProgress,
            signal,
          });
          if (blob) {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = backupFileName();
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
          }
          const completedAt = new Date().toISOString();
          localStorage.setItem(LAST_BACKUP_KEY, completedAt);
          setLastBackupAt(completedAt);
        },
      );
    },
    inspect: async (file) => {
      setBusy(true);
      setError(null);
      setInspection(null);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setInspection(
          await inspectLocalBackup({
            file,
            factory: indexedDB,
            storage: localStorage,
            mediaStorage: media.fileStorage,
            signal: controller.signal,
          }),
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "El archivo no es un backup válido.");
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    restore: async () => {
      if (!inspection) return;
      if (inspection.quotaSufficient === false) {
        setError("La cuota disponible no alcanza para staging y rollback seguros.");
        return;
      }
      await runMaintenance("restore", async (signal) => {
        await restoreLocalBackup({
          inspection,
          factory: indexedDB,
          storage: localStorage,
          mediaManager: createBrowserMediaStorageGenerationManager(indexedDB, localStorage),
          onProgress: setProgress,
          signal,
        });
        await cloud.clearLocalSessionForRestore();
        window.location.reload();
      });
    },
    clearInspection: () => {
      setInspection(null);
      setError(null);
    },
    cancel: () => abortRef.current?.abort(),
  };

  return <BackupContext.Provider value={value}>{children}</BackupContext.Provider>;
}

export function useBackup(): BackupRuntimeValue {
  const value = useContext(BackupContext);
  if (!value) throw new Error("useBackup debe utilizarse dentro de BackupProvider.");
  return value;
}
