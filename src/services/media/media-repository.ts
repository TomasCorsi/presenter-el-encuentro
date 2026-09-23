import type { MediaAsset } from "@/domain/media/media";

/**
 * Acceso a la METADATA de Media. Solo metadata: nunca toca los bytes de los
 * archivos (eso es MediaFileStorage) ni los Projects.
 */
export interface MediaRepository {
  list(): Promise<MediaAsset[]>;
  get(id: string): Promise<MediaAsset | null>;
  /** Crea o reemplaza la metadata del asset. */
  put(asset: MediaAsset): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Validación defensiva de lo leído de IndexedDB. */
export function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["workspaceId"] === "string" &&
    typeof candidate["name"] === "string" &&
    (candidate["kind"] === "image" || candidate["kind"] === "video") &&
    typeof candidate["mimeType"] === "string" &&
    typeof candidate["sizeBytes"] === "number" &&
    (candidate["storage"] === "opfs" ||
      candidate["storage"] === "indexeddb-blob" ||
      candidate["storage"] === "memory") &&
    typeof candidate["createdAt"] === "string" &&
    typeof candidate["updatedAt"] === "string"
  );
}
