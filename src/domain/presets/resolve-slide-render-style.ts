import type { PresetFontFamily, PresetStyle } from "./preset";
import { normalizePresetStyle } from "./preset-rules";

/**
 * Cálculo visual PURO: `PresetStyle` → valores listos para aplicar.
 *
 * Es la única implementación del cálculo; Live Preview, Live Program,
 * `/output/main` y la vista previa del editor solo APLICAN el resultado
 * (ADR-035). Sin DOM ni React: se prueba sin renderizar nada.
 *
 * Las medidas se expresan en unidades de contenedor (`cqh` / `cqw`) sobre un
 * lienzo 16:9 con `container-type: size`, de modo que un Preview pequeño y una
 * salida a 1920×1080 se ven proporcionalmente idénticos (ADR-037).
 */

const FONT_STACKS: Record<PresetFontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

export interface ResolvedSlideRenderStyle {
  fontFamily: string;
  /** Tamaño tipográfico relativo a la altura del lienzo. */
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  /** Eje vertical del contenedor flex. */
  justifyContent: "flex-start" | "center" | "flex-end";
  /** Eje horizontal del contenedor flex. */
  alignItems: "flex-start" | "center" | "flex-end";
  color: string;
  background: string;
  paddingInline: string;
  paddingBlock: string;
}

const JUSTIFY: Record<PresetStyle["verticalAlign"], ResolvedSlideRenderStyle["justifyContent"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const ALIGN_ITEMS: Record<PresetStyle["align"], ResolvedSlideRenderStyle["alignItems"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function resolveSlideRenderStyle(style: PresetStyle | undefined): ResolvedSlideRenderStyle {
  const safe = normalizePresetStyle(style);

  return {
    fontFamily: FONT_STACKS[safe.fontFamily],
    fontSize: `${round(safe.fontSize)}cqh`,
    fontWeight: safe.fontWeight,
    lineHeight: safe.lineHeight,
    textAlign: safe.align,
    justifyContent: JUSTIFY[safe.verticalAlign],
    alignItems: ALIGN_ITEMS[safe.align],
    color: safe.textColor,
    background: safe.background.color,
    paddingInline: `${round(safe.safeAreaX)}cqw`,
    paddingBlock: `${round(safe.safeAreaY)}cqh`,
  };
}
