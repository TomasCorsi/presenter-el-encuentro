import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

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
  /**
   * Solo Output: el video suena. Program de Live nunca pasa `audio` y queda
   * siempre muted. Si el navegador bloquea el autoplay con sonido, se muestra
   * "Activar salida" y el video sigue avanzando muted mientras tanto.
   */
  audio?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Desbloqueo de audio por VENTANA: tras un gesto del usuario el navegador
 * permite sonido en esta ventana durante toda su vida.
 */
let audioUnlockedInWindow = false;

/** `navigator.userActivation` cuando existe; si no, se asume que sí (se intentará). */
function windowHasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return activation ? activation.hasBeenActive : true;
}

function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

/**
 * Renderer de Media (imagen/video) a pantalla completa dentro de su marco.
 *
 * - Resuelve el archivo local por `mediaId` (nunca recibe bytes).
 * - Video con audio solo en Output (`audio`), sin controles nativos: la reproducción la
 *   ordena Live vía `playback`; aquí solo se aplica y se corrige la deriva.
 * - Archivo no disponible en este dispositivo → placeholder neutro.
 */
export function MediaSlideSurface({
  mediaId,
  kind,
  playback,
  audio = false,
  className,
  "data-testid": testId = "media-slide-surface",
}: MediaSlideSurfaceProps) {
  const url = useMediaUrl(mediaId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRevision = playback?.revision;
  const [needsActivation, setNeedsActivation] = useState(false);

  /** Reproduce con sonido si corresponde; ante bloqueo cae a muted + overlay. */
  const startPlayback = useCallback(
    (video: HTMLVideoElement) => {
      const playMuted = () => {
        video.muted = true;
        if (video.paused) void video.play().catch(() => undefined);
      };
      if (!audio) return playMuted();
      // Sin gesto previo en la ventana el navegador bloquearía el sonido (y
      // pausaría el video al desmutearlo): pedir activación sin intentarlo.
      if (!audioUnlockedInWindow && !windowHasUserActivation()) {
        setNeedsActivation(true);
        return playMuted();
      }
      video.muted = false;
      if (!video.paused) {
        audioUnlockedInWindow = true;
        return;
      }
      video.play().then(
        () => {
          audioUnlockedInWindow = true;
          setNeedsActivation(false);
        },
        (error: unknown) => {
          if (!isAutoplayBlocked(error)) return;
          setNeedsActivation(true);
          playMuted();
        },
      );
    },
    [audio],
  );

  const activateOutput = useCallback(() => {
    const video = videoRef.current;
    audioUnlockedInWindow = true;
    setNeedsActivation(false);
    if (!video) return;
    video.muted = false;
    if (playback?.state === "playing") void video.play().catch(() => undefined);
  }, [playback?.state]);

  // Aplicar el estado autoritativo de Live cuando cambia la revisión.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || url === null) return;
    const expected = expectedOffsetSeconds(playback, Date.now());
    if (Number.isFinite(expected) && Math.abs(video.currentTime - expected) > DRIFT_TOLERANCE_SECONDS) {
      video.currentTime = expected;
    }
    video.loop = playback.loop;
    if (playback.state === "playing") startPlayback(video);
    else {
      video.muted = !audio || !audioUnlockedInWindow;
      video.pause();
    }
  }, [audio, playback, playbackRevision, startPlayback, url]);

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
      className={cn("relative grid h-full w-full place-items-center bg-output-safe", className)}
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
      {audio && needsActivation && kind === "video" ? (
        <div className="absolute inset-0 grid place-items-center bg-background/60">
          <Button size="lg" onClick={activateOutput} onDoubleClick={(e) => e.stopPropagation()}>
            Activar salida
          </Button>
        </div>
      ) : null}
    </div>
  );
}
