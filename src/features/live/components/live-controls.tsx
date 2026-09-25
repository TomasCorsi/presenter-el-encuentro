import { ChevronLeft, ChevronRight, EyeOff, Play, SquareSlash } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProgramMode } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

export interface LiveControlsProps {
  canPrevious: boolean;
  canNext: boolean;
  canTake: boolean;
  programMode: ProgramMode;
  onPrevious(): void;
  onNext(): void;
  onTake(): void;
  onToggleMode(mode: Exclude<ProgramMode, "content">): void;
  compact?: boolean;
  short?: boolean;
}

/** Controles de operación. Solo TAKE envía contenido nuevo al aire. */
export function LiveControls({
  canPrevious,
  canNext,
  canTake,
  programMode,
  onPrevious,
  onNext,
  onTake,
  onToggleMode,
  compact = false,
  short = false,
}: LiveControlsProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center", compact ? "gap-1" : "gap-1.5")}
      role="group"
      aria-label="Controles de presentación"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={!canPrevious}
        onClick={onPrevious}
        title="Anterior (←) · avanza al aire dentro del item actual"
      >
        <ChevronLeft />
        Previous
        {!compact ? (
          <span className="ml-1 font-mono text-[10px] text-muted-foreground" aria-hidden="true">
            ←
          </span>
        ) : null}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!canNext}
        onClick={onNext}
        title="Siguiente (→) · avanza al aire dentro del item actual"
      >
        Next
        <ChevronRight />
        {!compact ? (
          <span className="ml-1 font-mono text-[10px] text-muted-foreground" aria-hidden="true">
            →
          </span>
        ) : null}
      </Button>
      <Button
        size="sm"
        disabled={!canTake}
        onClick={onTake}
        title="Envía la slide seleccionada a Program (Enter / Espacio)"
      >
        <Play />
        TAKE
        {!compact ? (
          <span className="ml-1 font-mono text-[10px] opacity-70" aria-hidden="true">
            ⏎
          </span>
        ) : null}
      </Button>
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
      <Button
        variant={programMode === "clear" ? "default" : "outline"}
        size="sm"
        aria-pressed={programMode === "clear"}
        onClick={() => onToggleMode("clear")}
        title="Salida vacía sin perder la slide al aire"
      >
        <SquareSlash />
        Clear
      </Button>
      <Button
        variant={programMode === "black" ? "default" : "outline"}
        size="sm"
        aria-pressed={programMode === "black"}
        onClick={() => onToggleMode("black")}
        title="Salida en negro sin perder la slide al aire"
      >
        <EyeOff />
        Black
      </Button>
      {!compact && !short ? (
        <p className="ml-auto hidden font-mono text-[10px] uppercase tracking-wide text-muted-foreground lg:block">
          ← anterior · → siguiente · enter take
        </p>
      ) : null}
    </div>
  );
}
