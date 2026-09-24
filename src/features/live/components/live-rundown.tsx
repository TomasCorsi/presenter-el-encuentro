import { X } from "lucide-react";

import type { PresentationItem } from "@/domain/presentation/presentation";
import { MEDIA_ON_AIR_REMOVAL_MESSAGE } from "@/domain/presentation/presentation-program";
import { cn } from "@/lib/utils";

export interface LiveRundownProps {
  items: readonly PresentationItem[];
  previewItemId: string | null;
  programItemId: string | null;
  onSelect(itemId: string): void;
  /** Quita la aparición del Project y del show en curso (ADR-045). */
  onRemove(itemId: string): void;
  /** Sin proyecto del show no se puede persistir la baja. */
  canRemove: boolean;
  /** Media al aire: quitar bloqueado (Fase 10). */
  isRemoveBlocked?: (itemId: string) => boolean;
}

/**
 * Rundown de la consola: seleccionar un elemento cambia la selección, NUNCA
 * Program. La única edición permitida es quitar la aparición del rundown.
 */
export function LiveRundown({
  items,
  previewItemId,
  programItemId,
  onSelect,
  onRemove,
  canRemove,
  isRemoveBlocked,
}: LiveRundownProps) {
  return (
    <ul className="flex flex-col gap-px bg-border" aria-label="Rundown del show">
      {items.map((item, index) => {
        const isPreview = item.id === previewItemId;
        const isProgram = item.id === programItemId;
        const missing = item.slides.length === 0;
        const blocked = isRemoveBlocked?.(item.id) ?? false;
        const states = [isProgram ? "en Program" : null, isPreview ? "seleccionado" : null]
          .filter(Boolean)
          .join(" y ");

        return (
          <li
            key={item.id}
            className={cn(
              "group flex items-stretch border-l-2 bg-card transition-colors",
              isProgram ? "border-l-live"
              : isPreview ? "border-l-primary"
              : "border-l-transparent",
              isPreview && "bg-muted",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isPreview ? "true" : undefined}
              aria-label={`${index + 1}. ${item.title}${states ? `, ${states}` : ""}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-5 text-foreground">
                  {item.title}
                </span>
                <span
                  className={cn(
                    "block font-mono text-[9px] uppercase tracking-wide",
                    missing ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {missing ? "sin contenido" : `${item.slides.length} slides`}
                </span>
              </span>
              {isProgram ? (
                <span className="shrink-0 rounded-sm border border-live/50 bg-live/15 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-live">
                  Air
                </span>
              ) : null}
            </button>

            {canRemove ? (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-disabled={blocked || undefined}
                aria-label={
                  blocked
                    ? `Quitar ${item.title} del rundown: ${MEDIA_ON_AIR_REMOVAL_MESSAGE}`
                    : `Quitar ${item.title} del rundown`
                }
                title={blocked ? MEDIA_ON_AIR_REMOVAL_MESSAGE : "Quitar del rundown"}
                className={cn(
                  "shrink-0 px-1.5 text-muted-foreground opacity-0 transition-opacity",
                  blocked ? "cursor-not-allowed hover:text-muted-foreground" : "hover:text-destructive",
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
