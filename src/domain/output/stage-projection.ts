import type { StageCue, StageProjection } from "@/domain/output/output-snapshot";
import type {
  PresentationItem,
  PresentationState,
  Slide,
} from "@/domain/presentation/presentation";
import { getProgramItem, getProgramSlide } from "@/domain/presentation/presentation-selectors";

function cueFrom(slide: Slide, item: PresentationItem | null): StageCue {
  return {
    slideId: slide.id,
    itemId: slide.itemId,
    itemTitle: item?.title ?? "Contenido al aire",
    itemType: item?.type ?? null,
    label: slide.label,
    content:
      slide.content.kind === "text"
        ? { kind: "text", lines: [...slide.content.lines] }
        : { ...slide.content },
    secondaryText: slide.secondaryText,
  };
}

/**
 * Proyección read-only para Stage. Program es la única referencia posicional;
 * Preview no participa en ningún caso.
 */
export function buildStageProjection(state: PresentationState): StageProjection {
  const currentSlide = getProgramSlide(state);
  if (!currentSlide) return { current: null, next: null };

  const currentItem = getProgramItem(state);
  const current = cueFrom(currentSlide, currentItem);

  // Una salida detached ya no tiene una posición confiable en el rundown.
  if (!state.programSlideId) return { current, next: null };

  const currentLocation = state.runtime.slideLocationById.get(state.programSlideId);
  if (!currentLocation) return { current, next: null };
  const nextId = state.runtime.navigableSlideIds[currentLocation.navigableIndex + 1];
  if (!nextId) return { current, next: null };

  const nextLocation = state.runtime.slideLocationById.get(nextId);
  if (!nextLocation) return { current, next: null };
  const nextItem = state.runtime.items[nextLocation.itemIndex] ?? null;
  const nextSlide = nextItem?.slides[nextLocation.slideIndex] ?? null;
  return { current, next: nextSlide ? cueFrom(nextSlide, nextItem) : null };
}
