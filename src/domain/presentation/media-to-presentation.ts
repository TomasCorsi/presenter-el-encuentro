import type { MediaAsset } from "@/domain/media/media";

import type { PresentationItem, Slide } from "./presentation";

export interface MediaToPresentationOptions {
  itemId: string;
  order?: number;
}

/**
 * Transformación pura MediaAsset → PresentationItem.
 *
 * UN ARCHIVO = UNA SLIDE. La slide guarda solo la referencia (`mediaId`):
 * los bytes los resuelve cada ventana a partir de su propio almacenamiento
 * local. No consulta repositories ni storage.
 */
export function mediaToPresentationItem(
  asset: MediaAsset,
  options: MediaToPresentationOptions,
): PresentationItem {
  const slide: Slide = {
    id: `${options.itemId}:media:0`,
    itemId: options.itemId,
    order: 0,
    content:
      asset.kind === "image"
        ? { kind: "image" as const, mediaId: asset.id }
        : { kind: "video" as const, mediaId: asset.id },
    label: asset.name,
  };

  return {
    id: options.itemId,
    type: "media",
    title: asset.name,
    order: options.order ?? 0,
    slides: [slide],
    sourceId: asset.id,
  };
}
