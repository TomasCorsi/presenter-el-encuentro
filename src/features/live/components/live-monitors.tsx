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
  content: "Program",
  clear: "Clear",
  black: "Black",
};

/** Monitores Preview y Program, lado a lado en escritorio. */
export function LiveMonitors({
  previewSlide,
  previewItem,
  programSlide,
  programItem,
  programMode,
}: LiveMonitorsProps) {
  const onAir = programMode === "content" ? programSlide : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section aria-labelledby="preview-title" className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="preview-title" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </h2>
          <span className="truncate text-xs text-muted-foreground">{previewItem?.title ?? "—"}</span>
        </div>
        <SlideSurface slide={previewSlide} emptyLabel="Sin slide seleccionada" />
      </section>

      <section aria-labelledby="program-title" className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="program-title" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Program
          </h2>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{programItem?.title ?? "—"}</span>
            <StatusBadge tone={onAir ? "live" : "neutral"} pulse={Boolean(onAir)}>
              {MODE_LABEL[programMode]}
            </StatusBadge>
          </div>
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
      </section>
    </div>
  );
}
