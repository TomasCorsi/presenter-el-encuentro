import type { PresentationItem } from "@/domain/presentation/presentation";
import { cn } from "@/lib/utils";

export interface LiveSlideGridProps {
  item: PresentationItem | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  /** Un clic manda la slide AL AIRE (ADR-043). */
  onGoLive(slideId: string): void;
}

function excerpt(lines: string[]): string {
  return lines.join(" · ").slice(0, 140);
}

/**
 * Slides del item seleccionado. Los estados Preview y Program NUNCA dependen
 * solo del color: cada miniatura lleva además una etiqueta textual, y una
 * misma slide puede mostrar las dos a la vez.
 */
export function LiveSlideGrid({ item, previewSlideId, programSlideId, onSelect }: LiveSlideGridProps) {
  if (!item) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        Selecciona un elemento del rundown para ver sus slides.
      </p>
    );
  }

  if (item.slides.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        Este elemento no tiene contenido disponible: no puede enviarse a Program.
      </p>
    );
  }

  return (
    <ul
      className="grid gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]"
      aria-label={`Slides de ${item.title}`}
    >
      {item.slides.map((slide, index) => {
        const isPreview = slide.id === previewSlideId;
        const isProgram = slide.id === programSlideId;
        const position = String(index + 1).padStart(2, "0");
        const states = [isProgram ? "en Program" : null, isPreview ? "en Preview" : null]
          .filter(Boolean)
          .join(" y ");

        return (
          <li key={slide.id}>
            <button
              type="button"
              onClick={() => onSelect(slide.id)}
              aria-current={isPreview ? "true" : undefined}
              aria-label={`Slide ${position}${slide.label ? ` ${slide.label}` : ""}${states ? `, ${states}` : ""}`}
              className={cn(
                "flex h-full w-full flex-col rounded-md border bg-card text-left transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isProgram ? "border-live" : isPreview ? "border-primary" : "border-border",
                isProgram && "ring-1 ring-live/50",
                isPreview && !isProgram && "ring-1 ring-primary/50",
              )}
            >
              <span className="flex items-center gap-2 border-b border-border/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{position}</span>
                <span className="min-w-0 flex-1 truncate">{slide.label ?? ""}</span>
              </span>

              <span className="block min-h-16 flex-1 px-2.5 py-2 text-xs leading-5 text-foreground">
                <span className="line-clamp-4">{excerpt(slide.content.lines)}</span>
              </span>

              {isPreview || isProgram ? (
                <span className="flex flex-wrap items-center gap-1 px-2 pb-2">
                  {isProgram ? (
                    <span className="rounded-sm border border-live/50 bg-live/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-live">
                      Program
                    </span>
                  ) : null}
                  {isPreview ? (
                    <span className="rounded-sm border border-primary/50 bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
                      Preview
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
