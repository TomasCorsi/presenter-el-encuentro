import type { PresentationItem } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

export interface LiveRundownProps {
  items: readonly PresentationItem[];
  previewItemId: string | null;
  programItemId: string | null;
  onSelect(itemId: string): void;
}

/** Rundown de solo lectura y densidad broadcast: Live nunca edita la secuencia. */
export function LiveRundown({ items, previewItemId, programItemId, onSelect }: LiveRundownProps) {
  return (
    <ul className="flex flex-col gap-px bg-border" aria-label="Rundown del show">
      {items.map((item, index) => {
        const isPreview = item.id === previewItemId;
        const isProgram = item.id === programItemId;
        const missing = item.slides.length === 0;
        const states = [isProgram ? "en Program" : null, isPreview ? "seleccionado" : null]
          .filter(Boolean)
          .join(" y ");

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isPreview ? "true" : undefined}
              aria-label={`${index + 1}. ${item.title}${states ? `, ${states}` : ""}`}
              className={cn(
                "flex w-full items-center gap-2 border-l-2 bg-card px-2 py-1.5 text-left transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isProgram ? "border-l-live"
                : isPreview ? "border-l-primary"
                : "border-l-transparent",
                isPreview && "bg-muted",
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
          </li>
        );
      })}
    </ul>
  );
}
