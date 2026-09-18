import { StatusBadge } from "@/components/ui/status-badge";
import type { PresentationItem, ProgramMode, Slide } from "@/domain/presentation/presentation";

import { SlideSurface } from "./slide-surface";

export interface LiveProgramMonitorProps {
  programSlide: Slide | null;
  programItem: PresentationItem | null;
  programMode: ProgramMode;
  /** La salida viene de un item que ya no está en el rundown (ADR-045). */
  detached: boolean;
}

const MODE_LABEL: Record<ProgramMode, string> = {
  content: "Content",
  clear: "Clear",
  black: "Black",
};

/**
 * Único monitor de la consola: Program, en 16:9 y con todo el ancho de la
 * columna derecha. Preview dejó de tener monitor propio (Fase 9.2): la slide
 * seleccionada se distingue en la rejilla.
 */
export function LiveProgramMonitor({
  programSlide,
  programItem,
  programMode,
  detached,
}: LiveProgramMonitorProps) {
  const onAir = programMode === "content" ? programSlide : null;

  return (
    <section aria-labelledby="program-title" className="flex min-h-0 min-w-0 flex-col">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2
          id="program-title"
          className="font-mono text-[11px] font-semibold uppercase tracking-wide text-live"
        >
          Program
        </h2>
        <StatusBadge tone={onAir ? "live" : "neutral"} pulse={Boolean(onAir)}>
          {MODE_LABEL[programMode]}
        </StatusBadge>
      </div>

      <SlideSurface
        slide={onAir}
        tone="program"
        live={Boolean(onAir)}
        emptyLabel={
          programMode === "black" ? "Salida en negro"
          : programMode === "clear" ? "Salida vacía"
          : "Nada al aire"
        }
      />

      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {programItem?.title ?? (detached ? "Fuera del rundown" : "—")}
      </p>
    </section>
  );
}
