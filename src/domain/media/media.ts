/**
 * Modelo de Media: imágenes y videos locales, offline (Fase 10).
 *
 * Dominio puro: sin React, sin DOM, sin IndexedDB/OPFS. La metadata
 * (MediaAsset) vive separada de los bytes del archivo, que guarda un
 * MediaFileStorage. Nada aquí conoce Live ni Output.
 */

export type MediaKind = "image" | "video";

/**
 * Qué almacenamiento físico guarda los bytes del asset. Se registra por
 * asset porque el respaldo (IndexedDB Blob) solo aplica a imágenes cuando
 * OPFS no está disponible.
 */
export type MediaStorageKind = "opfs" | "indexeddb-blob" | "memory";

export interface MediaAsset {
  id: string;
  workspaceId: string;
  /** Nombre visible; se edita desde /media. */
  name: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  /** Almacenamiento que contiene los bytes (para leerlos después). */
  storage: MediaStorageKind;
  width?: number | undefined;
  height?: number | undefined;
  /** Solo videos. */
  durationSeconds?: number | undefined;
  /** Miniatura pequeña (data URL JPEG) para grillas; nunca el archivo. */
  thumbnailDataUrl?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Formatos soportados en la Fase 10. GIF queda fuera explícitamente. */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const SUPPORTED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

export const MEDIA_ACCEPT_ATTRIBUTE = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...SUPPORTED_VIDEO_MIME_TYPES,
].join(",");
