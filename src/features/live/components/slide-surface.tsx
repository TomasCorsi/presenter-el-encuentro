import type { ComponentProps } from "react";

import type { Slide } from "@/domain/presentation/presentation";
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
 * Superficie 16:9 compartida por Preview y Program. Solo representa texto:
 * tipografía, fondos y presets llegan en fases posteriores.
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
        "flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border bg-stage p-6 text-center",
        tone === "program" && live ? "border-live/60" : "border-border",
        className,
      )}
      {...props}
    >
      {lines.length > 0 ? (
        <p className="max-h-full overflow-hidden text-balance text-lg font-semibold leading-snug text-stage-foreground lg:text-2xl">
          {lines.map((line, index) => (
            <span key={`${slide?.id}-${index}`} className="block">
              {line}
            </span>
          ))}
        </p>
      ) : (
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
