import { StatusBadge } from "@/components/ui/status-badge";
import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

import { SlideSurface } from "./slide-surface";

export interface LivePreviewMonitorProps {
  previewSlide: Slide | null;
  previewItem: PresentationItem | null;
  presetName?: string | null;
  compact?: boolean;
}

/** Monitor de preparación: representa Preview sin publicar ni controlar Program. */
export function LivePreviewMonitor({
  previewSlide,
  previewItem,
  presetName = null,
  compact = false,
}: LivePreviewMonitorProps) {
  return (
    <section aria-labelledby="preview-title" className="flex h-full min-h-0 min-w-0 flex-col">
      <div className={cn("flex items-center justify-between gap-2", compact ? "mb-1" : "mb-1.5")}>
        <h2
          id="preview-title"
          className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary"
        >
          Preview
        </h2>
        <StatusBadge tone="neutral">Preparado</StatusBadge>
      </div>

      <div
        data-testid="preview-monitor-viewport"
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-sm bg-black/20 [container-type:size]"
      >
        <SlideSurface slide={previewSlide} tone="preview" emptyLabel="Nada preparado" />
      </div>

      <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
        <span className="truncate text-foreground">{previewItem?.title ?? "—"}</span>
        {previewItem ? (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide">
            {previewItem.type}
          </span>
        ) : null}
        {presetName ? <span className="ml-auto shrink-0 truncate">{presetName}</span> : null}
      </div>
    </section>
  );
}
