import type { PresentationItem } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

export interface LiveSlideGridProps {
  item: PresentationItem | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  onSelect(slideId: string): void;
}

function excerpt(lines: string[]): string {
  return lines.join(" · ").slice(0, 90);
}

/** Slides del item seleccionado, con marca de Preview y de Program. */
export function LiveSlideGrid({ item, previewSlideId, programSlideId, onSelect }: LiveSlideGridProps) {
  if (!item) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Selecciona un elemento del rundown para ver sus slides.
      </p>
    );
  }

  if (item.slides.length === 0) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Este elemento no tiene contenido disponible: no puede enviarse a Program.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {item.slides.map((slide, index) => {
        const isPreview = slide.id === previewSlideId;
        const isProgram = slide.id === programSlideId;

        return (
          <li key={slide.id}>
            <button
              type="button"
              onClick={() => onSelect(slide.id)}
              aria-current={isPreview ? "true" : undefined}
              className={cn(
                "h-full w-full rounded-md border bg-card p-2.5 text-left transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isPreview ? "border-primary" : "border-border",
                isProgram && "border-l-2 border-l-live",
              )}
            >
              <span className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="truncate">{slide.label ?? ""}</span>
              </span>
              <span className="mt-1.5 block line-clamp-3 text-xs leading-5 text-foreground">
                {excerpt(slide.content.lines)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
