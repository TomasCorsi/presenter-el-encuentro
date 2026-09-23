import { useEffect, useRef } from "react";

import type { MediaKind } from "@/domain/media/media";
import { expectedOffsetSeconds, type VideoPlaybackState } from "@/domain/output/video-playback";
import { useMediaUrl } from "@/features/media/media-context";
import { cn } from "@/lib/utils";

/** Máxima deriva tolerada antes de corregir la posición del video. */
const DRIFT_TOLERANCE_SECONDS = 0.35;
const DRIFT_CHECK_INTERVAL_MS = 1000;

export interface MediaSlideSurfaceProps {
  mediaId: string;
  kind: MediaKind;
  /** Solo video: estado autoritativo de Live. Sin él, el video queda pausado. */
  playback?: VideoPlaybackState | undefined;
  className?: string;
  "data-testid"?: string;
}

/**
 * Renderer de Media (imagen/video) a pantalla completa dentro de su marco.
 *
 * - Resuelve el archivo local por `mediaId` (nunca recibe bytes).
 * - Video SIN AUDIO en la salida y sin controles nativos: la reproducción la
 *   ordena Live vía `playback`; aquí solo se aplica y se corrige la deriva.
 * - Archivo no disponible en este dispositivo → placeholder neutro.
 */
export function MediaSlideSurface({
  mediaId,
  kind,
  playback,
  className,
  "data-testid": testId = "media-slide-surface",
}: MediaSlideSurfaceProps) {
  const url = useMediaUrl(mediaId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRevision = playback?.revision;

  // Aplicar el estado autoritativo de Live cuando cambia la revisión.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || url === null) return;
    const expected = expectedOffsetSeconds(playback, Date.now());
    if (Number.isFinite(expected) && Math.abs(video.currentTime - expected) > DRIFT_TOLERANCE_SECONDS) {
      video.currentTime = expected;
    }
    if (playback.state === "playing") void video.play().catch(() => undefined);
    else video.pause();
    video.loop = playback.loop;
  }, [playback, playbackRevision, url]);

  // Vigilancia de deriva mientras reproduce.
  useEffect(() => {
    if (!playback || playback.state !== "playing") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      const expected = expectedOffsetSeconds(playback, Date.now(), duration);
      if (Math.abs(video.currentTime - expected) > DRIFT_TOLERANCE_SECONDS) {
        video.currentTime = expected;
      }
    }, DRIFT_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playback]);

  return (
    <div
      data-testid={testId}
      className={cn("grid h-full w-full place-items-center bg-output-safe", className)}
    >
      {url === null ? (
        <span className="text-sm text-muted-foreground">
          Este archivo no está disponible en este dispositivo
        </span>
      ) : kind === "image" ? (
        <img
          src={url}
          alt=""
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      ) : (
        <video
          ref={videoRef}
          src={url}
          className="max-h-full max-w-full object-contain"
          muted
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}
