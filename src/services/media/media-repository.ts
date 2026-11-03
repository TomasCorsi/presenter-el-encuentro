import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import { normalizeMediaTags } from "@/domain/media/media-rules";

/**
 * Acceso a la METADATA de Media. Solo metadata: nunca toca los bytes de los
 * archivos (eso es MediaFileStorage) ni los Projects.
 */
export interface MediaRepository {
  list(): Promise<MediaAsset[]>;
  get(id: string): Promise<MediaAsset | null>;
  /** Crea o reemplaza la metadata del asset. */
  put(asset: MediaAsset): Promise<void>;
  /** Escritura atómica de metadata dentro del repository. */
  putMany(assets: readonly MediaAsset[]): Promise<void>;
  delete(id: string): Promise<void>;
  listCollections(): Promise<MediaCollection[]>;
  getCollection(id: string): Promise<MediaCollection | null>;
  putCollection(collection: MediaCollection): Promise<void>;
  /** Elimina la colección y desasigna sus assets en una única transacción. */
  deleteCollectionAndUnassign(id: string, updatedAt: string): Promise<void>;
}

/** Parseo defensivo y migración en lectura de assets anteriores a Fase 10.3. */
export function parseMediaAsset(value: unknown): MediaAsset | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const valid =
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
    typeof candidate["updatedAt"] === "string";
  if (!valid) return null;

  return {
    ...(candidate as unknown as MediaAsset),
    tags: normalizeMediaTags(
      Array.isArray(candidate["tags"])
        ? candidate["tags"].filter((tag): tag is string => typeof tag === "string")
        : [],
    ),
    presentationUpdatedAt:
      typeof candidate["presentationUpdatedAt"] === "string"
        ? candidate["presentationUpdatedAt"]
        : (candidate["updatedAt"] as string),
    ...(typeof candidate["collectionId"] === "string" && candidate["collectionId"] !== ""
      ? { collectionId: candidate["collectionId"] }
      : { collectionId: undefined }),
  };
}

export function isMediaAsset(value: unknown): value is MediaAsset {
  return parseMediaAsset(value) !== null;
}

export function parseMediaCollection(value: unknown): MediaCollection | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate["id"] !== "string" ||
    typeof candidate["workspaceId"] !== "string" ||
    typeof candidate["name"] !== "string" ||
    typeof candidate["createdAt"] !== "string" ||
    typeof candidate["updatedAt"] !== "string"
  ) {
    return null;
  }
  return candidate as unknown as MediaCollection;
}
