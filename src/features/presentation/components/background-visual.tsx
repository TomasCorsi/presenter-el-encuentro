import { useEffect, useState } from "react";

import type { ResolvedSlideBackground } from "@/domain/presentation/presentation";

export type BackgroundMediaMode = "native" | "thumbnail";

export interface BackgroundVisualProps {
  background: ResolvedSlideBackground;
  /** URL ya resuelta por el consumidor. Nunca se buscan bytes desde este primitive. */
  mediaUrl?: string | null | undefined;
  /** Thumbnail fuerza una imagen estática incluso cuando el asset original es video. */
  mediaMode?: BackgroundMediaMode | undefined;
}

function backgroundIdentity(background: ResolvedSlideBackground): string {
  return background.type === "solid"
    ? `solid:${background.color}`
    : `media:${background.kind}:${background.mediaId}:${background.fallbackColor}`;
}

/**
 * Primitive visual compartido por superficies operativas y thumbnails.
 * Siempre pinta primero el solid resuelto; cualquier ausencia o error de Media
 * deja visible ese fallback sin introducir un color implícito.
 */
export function BackgroundVisual({
  background,
  mediaUrl = null,
  mediaMode = "native",
}: BackgroundVisualProps) {
  const [failed, setFailed] = useState(false);
  const identity = backgroundIdentity(background);

  useEffect(() => setFailed(false), [identity, mediaUrl]);

  const color = background.type === "solid" ? background.color : background.fallbackColor;
  const showMedia = background.type === "media" && Boolean(mediaUrl) && !failed;

  return (
    <div
      data-testid="background-visual"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: color }}
    >
      {showMedia && background.type === "media" ? (
        background.kind === "image" || mediaMode === "thumbnail" ? (
          <img
            src={mediaUrl ?? undefined}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading={mediaMode === "thumbnail" ? "lazy" : undefined}
            decoding={mediaMode === "thumbnail" ? "async" : undefined}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <video
            src={mediaUrl ?? undefined}
            aria-hidden="true"
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => setFailed(true)}
          />
        )
      ) : null}
    </div>
  );
}
