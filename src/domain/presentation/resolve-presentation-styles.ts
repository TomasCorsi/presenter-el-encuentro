import type { Preset } from "@/domain/presets/preset";
import { resolvePreset } from "@/domain/presets/preset-resolution";
import { cloneStyle } from "@/domain/presets/preset-rules";

import type { PresentationItem } from "./presentation";

/**
 * Congela el estilo de cada item (ADR-038).
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
): PresentationItem[] {
  return items.map((item) => {
    const preset = resolvePreset(item.presetId, presets);
    return {
      ...item,
      slides: item.slides.map((slide) => ({ ...slide, style: cloneStyle(preset.style) })),
    };
  });
}
