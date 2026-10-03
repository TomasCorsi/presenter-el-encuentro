import { ChevronDown, ChevronUp, X } from "lucide-react";

import type { PresentationItem } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

export interface LiveRundownProps {
  items: readonly PresentationItem[];
  previewItemId: string | null;
  programItemId: string | null;
  onSelect(itemId: string): void;
  onMove(itemId: string, direction: "up" | "down"): void;
  /** Quita la aparición del Project y del show en curso (ADR-045). */
  onRemove(itemId: string): void;
  /** Sin proyecto del show no se puede persistir la baja. */
  canRemove: boolean;
  /** Media al aire: quitar bloqueado (Fase 10). */
  removeBlockReason?: (itemId: string) => string | null;
  busy?: boolean;
  compact?: boolean;
}

const TYPE_LABEL: Record<PresentationItem["type"], string> = {
  song: "Song",
  bible: "Bible",
  media: "Media",
  presentation: "Presentation",
  countdown: "Countdown",
  message: "Message",
};

/**
 * Rundown de la consola: seleccionar un elemento cambia la selección, NUNCA
 * Program. La única edición permitida es quitar la aparición del rundown.
 */
export function LiveRundown({
  items,
  previewItemId,
  programItemId,
  onSelect,
  onMove,
  onRemove,
  canRemove,
  removeBlockReason,
  busy = false,
  compact = false,
}: LiveRundownProps) {
  return (
    <ul className="flex flex-col gap-px bg-border" aria-label="Rundown del show">
      {items.map((item, index) => {
        const isPreview = item.id === previewItemId;
        const isProgram = item.id === programItemId;
        const missing = item.slides.length === 0;
        const blockedReason = removeBlockReason?.(item.id) ?? null;
        const blocked = blockedReason !== null;
        const states = [isProgram ? "en Program" : null, isPreview ? "seleccionado" : null]
          .filter(Boolean)
          .join(" y ");

        return (
          <li
            key={item.id}
            className={cn(
              "group flex items-stretch border-l-2 bg-card transition-colors",
              isProgram ? "border-l-live" : isPreview ? "border-l-primary" : "border-l-transparent",
              isPreview && "bg-muted",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isPreview ? "true" : undefined}
              aria-label={`${index + 1}. ${item.title}${states ? `, ${states}` : ""}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 px-2 text-left transition-colors",
                compact ? "py-1" : "py-1.5",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[13px] font-medium text-foreground",
                    compact ? "leading-4" : "leading-5",
                  )}
                >
                  {item.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{TYPE_LABEL[item.type]}</span>
                  <span aria-hidden="true">·</span>
                  <span className={missing ? "text-warning" : undefined}>
                    {missing ? "sin contenido" : `${item.slides.length} slides`}
                  </span>
                  {isPreview ? <span className="text-primary">Preview</span> : null}
                  {isProgram ? <span className="text-live">Program</span> : null}
                </span>
              </span>
            </button>

            <span className="flex shrink-0 flex-col justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={() => onMove(item.id, "up")}
                aria-label={`Subir ${item.title}`}
                title="Subir en el rundown"
                className="grid flex-1 place-items-center px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busy || index === items.length - 1}
                onClick={() => onMove(item.id, "down")}
                aria-label={`Bajar ${item.title}`}
                title="Bajar en el rundown"
                className="grid flex-1 place-items-center px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3" aria-hidden="true" />
              </button>
            </span>

            {canRemove ? (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-disabled={blocked || undefined}
                aria-label={
                  blocked
                    ? `Quitar ${item.title} del rundown: ${blockedReason}`
                    : `Quitar ${item.title} del rundown`
                }
                title={blockedReason ?? "Quitar del rundown"}
                className={cn(
                  "shrink-0 px-1.5 text-muted-foreground opacity-0 transition-opacity",
                  blocked
                    ? "cursor-not-allowed hover:text-muted-foreground"
                    : "hover:text-destructive",
                  "focus-visible:opacity-100 focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  "group-hover:opacity-100",
                )}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
