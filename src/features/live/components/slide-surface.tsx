import type { ComponentProps } from "react";

import type { Slide } from "@/domain/presentation/presentation";
import type { VideoPlaybackState } from "@/domain/output/video-playback";
import { MediaSlideSurface } from "@/features/presentation/components/media-slide-surface";
import { SlideRenderer } from "@/features/presentation/components/slide-renderer";
import { cn } from "@/lib/utils";

export interface SlideSurfaceProps extends ComponentProps<"div"> {
  slide: Slide | null;
  /** Texto mostrado cuando no hay contenido que representar. */
  emptyLabel: string;
  /** `program` marca la superficie que está al aire. */
  tone?: "preview" | "program";
  live?: boolean;
  /** Solo slides de video: estado autoritativo de Live. */
  playback?: VideoPlaybackState | undefined;
}

/**
 * Superficie 16:9 compartida por Preview y Program. No define tipografía,
 * color ni fondo: delega en el renderer común (ADR-035), así que se ve igual
 * que `/output/main`. El contenido Media delega en el renderer de Media.
 */
export function SlideSurface({
  slide,
  emptyLabel,
  tone = "preview",
  live = false,
  playback,
  className,
  ...props
}: SlideSurfaceProps) {
  const content = slide?.content;
  const hasContent = content !== undefined && (content.kind !== "text" || content.lines.length > 0);

  return (
    <div
      className={cn(
        "aspect-video w-full overflow-hidden rounded-md border",
        tone === "program" ?
          live ? "border-live"
          : "border-live/40"
        : "border-primary/40",
        hasContent ? "bg-transparent" : "grid place-items-center bg-stage",
        className,
      )}
      {...props}
    >
      {!hasContent || !content ? (
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {emptyLabel}
        </p>
      ) : content.kind === "text" ? (
        <SlideRenderer lines={content.lines} style={slide?.style} secondaryText={slide?.secondaryText} />
      ) : (
        <MediaSlideSurface
          mediaId={content.mediaId}
          kind={content.kind}
          playback={content.kind === "video" ? playback : undefined}
        />
      )}
    </div>
  );
}
