import type { PresentationItem } from "@/domain/presentation/presentation";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export interface LiveRundownProps {
  items: readonly PresentationItem[];
  previewItemId: string | null;
  programItemId: string | null;
  onSelect(itemId: string): void;
}

/** Rundown de solo lectura: Live nunca edita la secuencia del Project. */
export function LiveRundown({ items, previewItemId, programItemId, onSelect }: LiveRundownProps) {
  return (
    <ul className="flex flex-col gap-px bg-border" aria-label="Rundown del show">
      {items.map((item, index) => {
        const isPreview = item.id === previewItemId;
        const isProgram = item.id === programItemId;
        const missing = item.slides.length === 0;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isPreview ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 bg-card px-3 py-2 text-left transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isPreview && "bg-muted",
                isProgram && "border-l-2 border-l-live",
              )}
            >
              <span className="w-6 shrink-0 font-mono text-[11px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{item.title}</span>
                <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {missing ? "sin contenido" : `${item.slides.length} slides`}
                </span>
              </span>
              {isProgram ? <StatusBadge tone="live" showDot={false}>On air</StatusBadge> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
