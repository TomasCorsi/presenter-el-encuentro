import type { CSSProperties } from "react";

import type { PresetStyle } from "@/domain/presets/preset";
import { resolveSlideRenderStyle } from "@/domain/presets/resolve-slide-render-style";
import { cn } from "@/lib/utils";

/**
 * Renderer ÚNICO de una slide de texto con su Preset (ADR-035).
 *
 * Lo consumen Live Preview, Live Program, `/output/main` y la vista previa del
 * editor de Presets. No conoce el App Shell, providers ni repositories: recibe
 * el contenido y el estilo ya resueltos.
 *
 * Todo el cálculo vive en `resolveSlideRenderStyle`; aquí solo se APLICA.
 */
export interface SlideRendererProps {
  lines: readonly string[];
  /** Estilo congelado; ausente o inválido cae al Default. */
  style: PresetStyle | undefined;
  className?: string | undefined;
}

export function SlideRenderer({ lines, style, className }: SlideRendererProps) {
  const resolved = resolveSlideRenderStyle(style);

  const surfaceStyle: CSSProperties = {
    containerType: "size",
    background: resolved.background,
  };

  const contentStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: resolved.justifyContent,
    alignItems: resolved.alignItems,
    paddingInline: resolved.paddingInline,
    paddingBlock: resolved.paddingBlock,
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    fontWeight: resolved.fontWeight,
    lineHeight: resolved.lineHeight,
    textAlign: resolved.textAlign,
    color: resolved.color,
  };

  return (
    <div
      data-testid="slide-renderer"
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={surfaceStyle}
    >
      <div className="h-full w-full" style={contentStyle}>
        {lines.map((line, index) => (
          <span key={`${index}-${line}`} className="block w-full">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
