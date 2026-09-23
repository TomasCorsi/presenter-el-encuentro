import { Pause, Play, Repeat, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VideoPlaybackState } from "@/domain/output/video-playback";
import { cn } from "@/lib/utils";

export type VideoPlaybackCommand = "toggle-play" | "restart" | "toggle-loop";

export interface LiveVideoControlsProps {
  playback: VideoPlaybackState;
  disabled?: boolean;
  onCommand(command: VideoPlaybackCommand): void;
}

/**
 * Controles de reproducción del video al aire. Live es la autoridad: cada
 * comando actualiza el VideoPlaybackState y el cambio viaja a Output por el
 * protocolo de sincronización (Output nunca decide por su cuenta).
 */
export function LiveVideoControls({ playback, disabled = false, onCommand }: LiveVideoControlsProps) {
  return (
    <div
      className="mt-1.5 flex items-center gap-1"
      role="group"
      aria-label="Controles del video al aire"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onCommand("toggle-play")}
        aria-label={playback.state === "playing" ? "Pausar video" : "Reproducir video"}
      >
        {playback.state === "playing" ? <Pause /> : <Play />}
        {playback.state === "playing" ? "Pausar" : "Reproducir"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onCommand("restart")}
        aria-label="Reiniciar video desde el inicio"
      >
        <RotateCcw />
        Reiniciar
      </Button>
      <Button
        variant={playback.loop ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => onCommand("toggle-loop")}
        aria-pressed={playback.loop}
        aria-label="Repetir el video en bucle"
        className={cn(playback.loop && "bg-primary text-primary-foreground")}
      >
        <Repeat />
        Loop
      </Button>
    </div>
  );
}
