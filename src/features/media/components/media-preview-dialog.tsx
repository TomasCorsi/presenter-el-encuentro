import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaAsset } from "@/domain/media/media";
import { useMediaUrl } from "@/features/media/media-context";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export interface MediaPreviewDialogProps {
  asset: MediaAsset | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

/** Preview local: nunca consulta ni modifica el Presentation Store. */
export function MediaPreviewDialog({ asset, open, onOpenChange }: MediaPreviewDialogProps) {
  const url = useMediaUrl(asset?.id ?? null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loop, setLoop] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = asset?.durationSeconds ?? videoRef.current?.duration ?? 0;

  useEffect(() => {
    if (open) return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setPlaying(false);
    setMuted(true);
    setLoop(false);
    setCurrentTime(0);
  }, [open]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{asset?.name ?? "Preview"}</DialogTitle>
          <DialogDescription>
            Vista previa local independiente de Preview y Program.
          </DialogDescription>
        </DialogHeader>

        <div className="grid aspect-video place-items-center overflow-hidden rounded-md bg-output-safe">
          {!asset || !url ? (
            <p className="text-sm text-muted-foreground">
              Este archivo no estÃ¡ disponible en este dispositivo.
            </p>
          ) : asset.kind === "image" ? (
            <img src={url} alt={asset.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              src={url}
              muted={muted}
              loop={loop}
              playsInline
              preload="metadata"
              className="max-h-full max-w-full object-contain"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
            />
          )}
        </div>

        {asset?.kind === "video" ? (
          <div className="grid gap-2">
            <progress
              aria-label="Progreso del preview"
              value={currentTime}
              max={duration || 1}
              className="h-1.5 w-full accent-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={togglePlay}
                disabled={!url}
              >
                {playing ? <Pause /> : <Play />}
                {playing ? "Pausa" : "Reproducir"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!url}
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.currentTime = 0;
                  setCurrentTime(0);
                  if (!video.paused) void video.play().catch(() => undefined);
                }}
              >
                <RotateCcw /> Reiniciar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={loop ? "default" : "outline"}
                onClick={() => setLoop((value) => !value)}
              >
                Loop {loop ? "on" : "off"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMuted((value) => !value)}
              >
                {muted ? <VolumeX /> : <Volume2 />}
                {muted ? "Activar audio" : "Silenciar"}
              </Button>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
