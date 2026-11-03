import type { Project } from "@/domain/projects/project";

import {
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_VIDEO_MIME_TYPES,
  type MediaAsset,
  type MediaCollection,
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

export function normalizeMediaText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const MAX_RESULTS = 60;

/** Etiqueta canónica para persistencia: legible, simple y estable. */
export function normalizeMediaTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").normalize("NFC").toLocaleLowerCase("es");
}

export function normalizeMediaTags(tags: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = normalizeMediaTag(raw);
    const key = normalizeMediaText(tag);
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
  }
  return normalized;
}

export type MediaQuickFilter = "all" | "image" | "video" | "favorites" | "recent";
export type MediaSort = "newest" | "name-asc" | "name-desc" | "size" | "duration";
export type MediaCollectionFilter = "all" | "unassigned" | string;

export interface MediaLibraryQuery {
  query?: string;
  collectionId?: MediaCollectionFilter;
  filter?: MediaQuickFilter;
  sort?: MediaSort;
  favoriteIds?: readonly string[];
  recentIds?: readonly string[];
  limit?: number;
}

/** Selector único para búsqueda, filtros y orden; trabaja sólo con metadata. */
export function queryMediaLibrary(
  assets: readonly MediaAsset[],
  collections: readonly MediaCollection[],
  options: MediaLibraryQuery = {},
): MediaAsset[] {
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
  const favoriteIds = new Set(options.favoriteIds ?? []);
  const recentOrder = new Map((options.recentIds ?? []).map((id, index) => [id, index]));
  const tokens = normalizeMediaText(options.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const collectionId = options.collectionId ?? "all";
  const filter = options.filter ?? "all";

  const visible = assets.filter((asset) => {
    if (collectionId === "unassigned") {
      if (asset.collectionId && collectionsById.has(asset.collectionId)) return false;
    } else if (collectionId !== "all" && asset.collectionId !== collectionId) {
      return false;
    }
    if (filter === "image" && asset.kind !== "image") return false;
    if (filter === "video" && asset.kind !== "video") return false;
    if (filter === "favorites" && !favoriteIds.has(asset.id)) return false;
    if (filter === "recent" && !recentOrder.has(asset.id)) return false;

    if (tokens.length === 0) return true;
    const collectionName = asset.collectionId
      ? (collectionsById.get(asset.collectionId)?.name ?? "")
      : "";
    const haystack = normalizeMediaText(
      [asset.name, ...(asset.tags ?? []), collectionName].join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });

  const sort = filter === "recent" ? "recent" : (options.sort ?? "newest");
  visible.sort((a, b) => {
    if (sort === "recent") {
      return (recentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (recentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === "name-asc") return a.name.localeCompare(b.name, "es");
    if (sort === "name-desc") return b.name.localeCompare(a.name, "es");
    if (sort === "size") return b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name, "es");
    if (sort === "duration") {
      const aDuration = a.durationSeconds ?? -1;
      const bDuration = b.durationSeconds ?? -1;
      return bDuration - aDuration || a.name.localeCompare(b.name, "es");
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.name.localeCompare(b.name, "es");
  });

  return options.limit === undefined ? visible : visible.slice(0, options.limit);
}

/** Wrapper retrocompatible para pickers compactos existentes. */
export function searchMedia(assets: readonly MediaAsset[], query: string): MediaAsset[] {
  const needle = normalizeMediaText(query);
  const sorted = [...assets].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!needle) return sorted.slice(0, MAX_RESULTS);
  return sorted
    .filter((asset) =>
      normalizeMediaText([asset.name, ...(asset.tags ?? [])].join(" ")).includes(needle),
    )
    .slice(0, MAX_RESULTS);
}

export interface MediaUsage {
  /** Apariciones totales, contando repeticiones. */
  occurrences: number;
  /** Nombres de los projects que lo usan, sin repetir. */
  projectNames: string[];
  /** Referencias exactas; la UI puede agruparlas sin volver a leer Projects. */
  references: MediaUsageReference[];
}

export interface MediaUsageReference {
  projectId: string;
  projectName: string;
  itemId: string;
  itemTitle: string;
  role: "content" | "song-background" | "bible-background";
}

/**
 * Regla pura de uso: un MediaAsset está en uso si aparece como `sourceId`
 * de algún RundownItem de tipo "media". Media es REFERENCIA (no copia), así
 * que eliminar un asset en uso rompería el show: la UI lo bloquea.
 */
export function findMediaUsage(projects: readonly Project[], mediaId: string): MediaUsage {
  const references: MediaUsageReference[] = [];
  const projectNames: string[] = [];

  for (const project of projects) {
    let matches = 0;
    for (const item of project.rundown) {
      const role =
        item.type === "media" && item.sourceId === mediaId
          ? "content"
          : item.type === "song" && item.background?.mediaId === mediaId
            ? "song-background"
            : item.type === "bible" && item.background?.mediaId === mediaId
              ? "bible-background"
              : null;
      if (!role) continue;
      matches += 1;
      references.push({
        projectId: project.id,
        projectName: project.name,
        itemId: item.id,
        itemTitle: item.title,
        role,
      });
    }
    if (matches > 0) {
      projectNames.push(project.name);
    }
  }

  return { occurrences: references.length, projectNames, references };
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
