import { memo } from "react";

import type { Slide } from "@/domain/presentation/presentation";
import { DEFAULT_PRESET_STYLE } from "@/domain/presets/preset";
import { cn } from "@/lib/utils";

import { BackgroundVisual } from "./background-visual";
import { SlideRenderer } from "./slide-renderer";

export interface SlideThumbnailSurfaceProps {
  slide: Slide;
  /** Miniatura de metadata; nunca una URL obtenida desde MediaFileStorage. */
  backgroundThumbnailDataUrl?: string | undefined;
  className?: string | undefined;
}

/** Superficie estática para cards Song/Bible. No monta video ni resuelve bytes. */
function SlideThumbnailSurfaceComponent({
  slide,
  backgroundThumbnailDataUrl,
  className,
}: SlideThumbnailSurfaceProps) {
  const style = slide.style ?? DEFAULT_PRESET_STYLE;
  const background = slide.background ?? {
    type: "solid" as const,
    color: style.background.color,
  };
  const content = slide.content;

  return (
    <div
      data-testid="slide-thumbnail-surface"
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <BackgroundVisual
        background={background}
        mediaUrl={backgroundThumbnailDataUrl}
        mediaMode="thumbnail"
      />
      {content.kind === "text" ? (
        <div className="absolute inset-0">
          <SlideRenderer
            lines={content.lines}
            style={style}
            secondaryText={slide.secondaryText}
            transparentBackground
          />
        </div>
      ) : null}
    </div>
  );
}

export const SlideThumbnailSurface = memo(SlideThumbnailSurfaceComponent);
