import { Film } from "lucide-react";
import { memo } from "react";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { slideTextLines } from "@/domain/presentation/presentation";
import { SlideThumbnailSurface } from "@/features/presentation/components/slide-thumbnail-surface";
import { cn } from "@/lib/utils";

export interface LiveSlideGridProps {
  item: PresentationItem | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  /** Metadata estática precalculada; no contiene ni resuelve bytes Media. */
  backgroundThumbnails?: ReadonlyMap<string, string> | undefined;
  /** Un clic manda la slide AL AIRE (ADR-043). */
  onGoLive(slideId: string): void;
  compact?: boolean;
  narrow?: boolean;
}

function excerpt(slide: Slide): string {
  if (slide.content.kind !== "text") {
    return slide.content.kind === "image" ? "Imagen" : "Video";
  }
  return slideTextLines(slide.content).join(" · ").slice(0, 140);
}

interface LiveSlideCardProps {
  slide: Slide;
  index: number;
  isPreview: boolean;
  isProgram: boolean;
  backgroundThumbnailDataUrl?: string | undefined;
  onGoLive(slideId: string): void;
}

const LiveSlideCard = memo(function LiveSlideCard({
  slide,
  index,
  isPreview,
  isProgram,
  backgroundThumbnailDataUrl,
  onGoLive,
}: LiveSlideCardProps) {
  const position = String(index + 1).padStart(2, "0");
  const states = [isProgram ? "en Program" : null, isPreview ? "en Preview" : null]
    .filter(Boolean)
    .join(" y ");
  const hasVideoBackground =
    slide.background?.type === "media" && slide.background.kind === "video";

  return (
    <li>
      <button
        type="button"
        onClick={() => onGoLive(slide.id)}
        aria-current={isPreview ? "true" : undefined}
        title="Enviar esta slide al aire"
        aria-label={`Enviar al aire la slide ${position}${slide.label ? ` ${slide.label}` : ""}${states ? `, ${states}` : ""}`}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-md border bg-card text-left transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isProgram ? "border-live" : isPreview ? "border-primary" : "border-border",
          isProgram && "ring-1 ring-live/50",
          isPreview && !isProgram && "ring-1 ring-primary/50",
        )}
      >
        <span className="flex items-center gap-2 border-b border-border/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{position}</span>
          <span className="min-w-0 flex-1 truncate">{slide.label ?? ""}</span>
          {hasVideoBackground ? (
            <span
              className="inline-flex items-center gap-1 normal-case tracking-normal"
              aria-label="Fondo de video representado con una miniatura estática"
            >
              <Film className="size-3" aria-hidden="true" />
              Video
            </span>
          ) : null}
        </span>

        {slide.content.kind === "text" ? (
          <div className="aspect-video w-full overflow-hidden border-b border-border/70 bg-stage">
            <SlideThumbnailSurface
              slide={slide}
              backgroundThumbnailDataUrl={backgroundThumbnailDataUrl}
            />
          </div>
        ) : (
          <span className="block min-h-16 flex-1 px-2.5 py-2 text-xs leading-5 text-foreground">
            <span className="line-clamp-4">{excerpt(slide)}</span>
          </span>
        )}

        {isPreview || isProgram ? (
          <span className="flex flex-wrap items-center gap-1 px-2 py-2">
            {isProgram ? (
              <span className="rounded-sm border border-live/50 bg-live/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-live">
                Program
              </span>
            ) : null}
            {isPreview ? (
              <span className="rounded-sm border border-primary/50 bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
                Preview
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </li>
  );
});

/**
 * Slides del item seleccionado. Los estados Preview y Program se dibujan en
 * el chrome de la card; nunca alteran el contenido visual de la miniatura.
 */
export function LiveSlideGrid({
  item,
  previewSlideId,
  programSlideId,
  backgroundThumbnails,
  onGoLive,
  compact = false,
  narrow = false,
}: LiveSlideGridProps) {
  if (!item) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        Selecciona un elemento del rundown para ver sus slides.
      </p>
    );
  }

  if (item.slides.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        Este elemento no tiene contenido disponible: no puede enviarse a Program.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "grid",
        compact
          ? "gap-1.5 p-1.5 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]"
          : narrow
            ? "gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]"
            : "gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]",
      )}
      aria-label={`Slides de ${item.title}`}
    >
      {item.slides.map((slide, index) => {
        const mediaId = slide.background?.type === "media" ? slide.background.mediaId : null;
        return (
          <LiveSlideCard
            key={slide.id}
            slide={slide}
            index={index}
            isPreview={slide.id === previewSlideId}
            isProgram={slide.id === programSlideId}
            backgroundThumbnailDataUrl={mediaId ? backgroundThumbnails?.get(mediaId) : undefined}
            onGoLive={onGoLive}
          />
        );
      })}
    </ul>
  );
}
