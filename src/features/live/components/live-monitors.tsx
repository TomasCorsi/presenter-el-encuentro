import type { PresentationItem, ProgramMode, Slide } from "@/domain/presentation/presentation";
import { StatusBadge } from "@/components/ui/status-badge";

import { SlideSurface } from "./slide-surface";

export interface LiveMonitorsProps {
  previewSlide: Slide | null;
  previewItem: PresentationItem | null;
  programSlide: Slide | null;
  programItem: PresentationItem | null;
  programMode: ProgramMode;
}

const MODE_LABEL: Record<ProgramMode, string> = {
  content: "Content",
  clear: "Clear",
  black: "Black",
};

/**
 * Monitores apilados: Program arriba (prioridad visual) y Preview debajo, más
 * compacto. Cada uno lleva su etiqueta textual además del acento de color.
 */
export function LiveMonitors({
  previewSlide,
  previewItem,
  programSlide,
  programItem,
  programMode,
}: LiveMonitorsProps) {
  const onAir = programMode === "content" ? programSlide : null;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <section aria-labelledby="program-title" className="min-w-0">
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
          {programItem?.title ?? "—"}
        </p>
      </section>

      <section aria-labelledby="preview-title" className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2
            id="preview-title"
            className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary"
          >
            Preview
          </h2>
          <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Selección
          </span>
        </div>
        <SlideSurface slide={previewSlide} tone="preview" emptyLabel="Sin slide seleccionada" />
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {previewItem?.title ?? "—"}
        </p>
      </section>
    </div>
  );
}
