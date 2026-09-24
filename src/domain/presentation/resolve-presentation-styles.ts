import type { Preset } from "@/domain/presets/preset";
import type { MediaAsset } from "@/domain/media/media";
import { resolvePreset } from "@/domain/presets/preset-resolution";
import { cloneStyle } from "@/domain/presets/preset-rules";

import type { PresentationItem } from "./presentation";

/**
 * Congela el estilo de cada item (ADR-036).
 *
 * Entrada: contenido ya compuesto (`projectToPresentation`) + la biblioteca de
 * Presets en el instante de la carga. Salida: los mismos items con el estilo
 * RESUELTO en cada slide, listo para el Presentation Engine, Live y Output.
 *
 * Es el único punto donde el contenido se cruza con los Presets: ni la
 * composición ni el motor consultan Presets.
 */
export function resolvePresentationStyles(
  items: readonly PresentationItem[],
  presets: readonly Preset[],
  media: readonly MediaAsset[] = [],
): PresentationItem[] {
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  return items.map((item) => {
    const preset = resolvePreset(item.presetId, presets);
    const asset = item.background ? mediaById.get(item.background.mediaId) : undefined;
    const background = asset
      ? {
          type: "media" as const,
          mediaId: asset.id,
          kind: asset.kind,
          fallbackColor: preset.style.background.color,
        }
      : { type: "solid" as const, color: preset.style.background.color };
    return {
      ...item,
      slides: item.slides.map((slide) => ({
        ...slide,
        style: cloneStyle(preset.style),
        background: { ...background },
      })),
    };
  });
}
