import type { ComponentProps } from "react";

import type { Slide } from "@/domain/presentation/presentation";
import { SlideRenderer } from "@/features/presentation/components/slide-renderer";
import { cn } from "@/lib/utils";

export interface SlideSurfaceProps extends ComponentProps<"div"> {
  slide: Slide | null;
  /** Texto mostrado cuando no hay contenido que representar. */
  emptyLabel: string;
  /** `program` marca la superficie que está al aire. */
  tone?: "preview" | "program";
  live?: boolean;
}

/**
 * Superficie 16:9 compartida por Preview y Program. No define tipografía,
 * color ni fondo: delega en el renderer común (ADR-035), así que se ve igual
 * que `/output/main`.
 */
export function SlideSurface({
  slide,
  emptyLabel,
  tone = "preview",
  live = false,
  className,
  ...props
}: SlideSurfaceProps) {
  const lines = slide?.content.lines ?? [];

  return (
    <div
      className={cn(
        "aspect-video w-full overflow-hidden rounded-md border",
        tone === "program" && live ? "border-live/60" : "border-border",
        lines.length > 0 ? "bg-transparent" : "grid place-items-center bg-stage",
        className,
      )}
      {...props}
    >
      {lines.length > 0 ? (
        <SlideRenderer lines={lines} style={slide?.style} />
      ) : (
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
