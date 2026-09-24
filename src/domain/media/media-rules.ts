import type { Project } from "@/domain/projects/project";

import {
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_VIDEO_MIME_TYPES,
  type MediaAsset,
  type MediaKind,
} from "./media";

/**
 * Reglas puras de Media: validación de archivos, búsqueda en la biblioteca
 * y uso dentro de los Projects. Sin DOM ni persistencia.
 */

export function mediaKindForMime(mimeType: string): MediaKind | null {
  const normalized = mimeType.toLowerCase();
  if ((SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)) return "image";
  if ((SUPPORTED_VIDEO_MIME_TYPES as readonly string[]).includes(normalized)) return "video";
  return null;
}

export interface MediaFileDescriptor {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Valida un archivo ANTES de importarlo. Devuelve el mensaje para el
 * operador o `null` si es importable.
 */
export function validateMediaFile(file: MediaFileDescriptor): string | null {
  if (mediaKindForMime(file.mimeType) === null) {
    return `«${file.name}» no es un formato soportado (imágenes PNG, JPEG o WEBP; videos MP4 o WEBM).`;
  }
  if (file.sizeBytes <= 0) {
    return `«${file.name}» está vacío.`;
  }
  return null;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const MAX_RESULTS = 60;

/** Búsqueda por nombre, tolerante a acentos y mayúsculas (como Songs). */
export function searchMedia(assets: readonly MediaAsset[], query: string): MediaAsset[] {
  const needle = normalize(query);
  const sorted = [...assets].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!needle) return sorted.slice(0, MAX_RESULTS);
  return sorted.filter((asset) => normalize(asset.name).includes(needle)).slice(0, MAX_RESULTS);
}

export interface MediaUsage {
  /** Apariciones totales, contando repeticiones. */
  occurrences: number;
  /** Nombres de los projects que lo usan, sin repetir. */
  projectNames: string[];
}

/**
 * Regla pura de uso: un MediaAsset está en uso si aparece como `sourceId`
 * de algún RundownItem de tipo "media". Media es REFERENCIA (no copia), así
 * que eliminar un asset en uso rompería el show: la UI lo bloquea.
 */
export function findMediaUsage(projects: readonly Project[], mediaId: string): MediaUsage {
  let occurrences = 0;
  const projectNames: string[] = [];

  for (const project of projects) {
    const matches = project.rundown.filter(
      (item) =>
        (item.type === "media" && item.sourceId === mediaId) ||
        ((item.type === "song" || item.type === "bible") &&
          item.background?.mediaId === mediaId),
    ).length;
    if (matches > 0) {
      occurrences += matches;
      projectNames.push(project.name);
    }
  }

  return { occurrences, projectNames };
}

/** Tamaño legible para la UI (puro, sin Intl para ser determinista). */
export function formatMediaSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kib = sizeBytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MB`;
  return `${(mib / 1024).toFixed(2)} GB`;
}
