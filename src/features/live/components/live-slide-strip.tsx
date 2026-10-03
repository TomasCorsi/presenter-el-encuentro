import { Film } from "lucide-react";
import { memo, useEffect, useRef, type KeyboardEvent } from "react";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { slideTextLines } from "@/domain/presentation/presentation";
import { SlideThumbnailSurface } from "@/features/presentation/components/slide-thumbnail-surface";
import { cn } from "@/lib/utils";

export interface LiveSlideStripProps {
  item: PresentationItem | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  /** Metadata estática precalculada; no contiene ni resuelve bytes Media. */
  backgroundThumbnails?: ReadonlyMap<string, string> | undefined;
  onSelect(slideId: string): void;
  /** Selecciona la slide indicada y la envía a Program como una sola intención. */
  onTake(slideId: string): void;
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
  compact: boolean;
  narrow: boolean;
  onSelect(slideId: string): void;
  onTake(slideId: string): void;
}

const LiveSlideCard = memo(function LiveSlideCard({
  slide,
  index,
  isPreview,
  isProgram,
  backgroundThumbnailDataUrl,
  compact,
  narrow,
  onSelect,
  onTake,
}: LiveSlideCardProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const position = String(index + 1).padStart(2, "0");
  const states = [isProgram ? "en Program" : null, isPreview ? "en Preview" : null]
    .filter(Boolean)
    .join(" y ");
  const hasVideoBackground =
    slide.background?.type === "media" && slide.background.kind === "video";

  useEffect(() => {
    if (isPreview) {
      buttonRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [isPreview]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onTake(slide.id);
  }

  return (
    <li
      className={cn(
        "flex h-full shrink-0 snap-start items-center",
        compact ? "w-44" : narrow ? "w-[184px]" : "w-[204px]",
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onSelect(slide.id)}
        onDoubleClick={() => onTake(slide.id)}
        onKeyDown={handleKeyDown}
        aria-current={isPreview ? "true" : undefined}
        title="Un clic prepara Preview; doble clic envía a Program"
        aria-label={`Preparar la slide ${position}${slide.label ? ` ${slide.label}` : ""}${states ? `, ${states}` : ""}`}
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-md border bg-stage text-left shadow-sm transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isProgram ? "border-live" : isPreview ? "border-primary" : "border-border",
          isProgram && "ring-1 ring-live/50",
          isPreview && !isProgram && "ring-1 ring-primary/50",
        )}
      >
        {slide.content.kind === "text" ? (
          <div className="absolute inset-0">
            <SlideThumbnailSurface
              slide={slide}
              backgroundThumbnailDataUrl={backgroundThumbnailDataUrl}
            />
          </div>
        ) : (
          <span className="absolute inset-0 grid place-items-center px-8 text-center text-xs leading-5 text-foreground">
            <span className="line-clamp-2">{excerpt(slide)}</span>
          </span>
        )}

        <span className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/80 to-transparent px-2 pb-4 pt-1.5 font-mono text-[10px] uppercase tracking-wide text-white/90">
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

        {isPreview || isProgram ? (
          <span className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
            {isProgram ? (
              <span className="rounded-sm border border-live/70 bg-black/65 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-live">
                Program
              </span>
            ) : null}
            {isPreview ? (
              <span className="rounded-sm border border-primary/70 bg-black/65 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
                Preview
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </li>
  );
});

/** Slides del item seleccionado, en una tira horizontal de preparación rápida. */
export function LiveSlideStrip({
  item,
  previewSlideId,
  programSlideId,
  backgroundThumbnails,
  onSelect,
  onTake,
  compact = false,
  narrow = false,
}: LiveSlideStripProps) {
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
      data-testid="live-slide-strip"
      className={cn(
        "flex h-full snap-x snap-proximity overflow-x-auto overflow-y-hidden",
        compact ? "gap-1.5 p-1.5" : "gap-2 p-2",
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
            compact={compact}
            narrow={narrow}
            onSelect={onSelect}
            onTake={onTake}
          />
        );
      })}
    </ul>
  );
}
