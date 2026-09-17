import { ChevronLeft, ChevronRight, EyeOff, Play, SquareSlash } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProgramMode } from "@/domain/presentation/presentation";

export interface LiveControlsProps {
  canPrevious: boolean;
  canNext: boolean;
  canTake: boolean;
  programMode: ProgramMode;
  onPrevious(): void;
  onNext(): void;
  onTake(): void;
  onToggleMode(mode: Exclude<ProgramMode, "content">): void;
}

/** Controles de operación. Solo TAKE envía contenido al aire. */
export function LiveControls({
  canPrevious,
  canNext,
  canTake,
  programMode,
  onPrevious,
  onNext,
  onTake,
  onToggleMode,
}: LiveControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Controles de presentación">
      <Button variant="outline" size="sm" disabled={!canPrevious} onClick={onPrevious} title="Anterior (←)">
        <ChevronLeft />Previous
      </Button>
      <Button variant="outline" size="sm" disabled={!canNext} onClick={onNext} title="Siguiente (→)">
        Next<ChevronRight />
      </Button>
      <Button size="sm" disabled={!canTake} onClick={onTake} title="Enviar a Program (Enter / Espacio)">
        <Play />TAKE
      </Button>
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
      <Button
        variant={programMode === "clear" ? "default" : "outline"}
        size="sm"
        aria-pressed={programMode === "clear"}
        onClick={() => onToggleMode("clear")}
        title="Salida vacía sin perder la slide al aire"
      >
        <SquareSlash />Clear
      </Button>
      <Button
        variant={programMode === "black" ? "default" : "outline"}
        size="sm"
        aria-pressed={programMode === "black"}
        onClick={() => onToggleMode("black")}
        title="Salida en negro sin perder la slide al aire"
      >
        <EyeOff />Black
      </Button>
      <p className="ml-auto hidden font-mono text-[10px] uppercase tracking-wide text-muted-foreground lg:block">
        ← anterior · → siguiente · enter take
      </p>
    </div>
  );
}
