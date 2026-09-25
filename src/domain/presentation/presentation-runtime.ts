import type {
  PresentationItem,
  PresentationRuntime,
  SlideLocation,
} from "./presentation";

/**
 * Construye los índices derivados de una presentación.
 *
 * Función pura: se invoca solo cuando cambia la presentación. El resultado es
 * inmutable y permite resolver navegación y selección en O(1).
 */
export function buildPresentationRuntime(items: PresentationItem[]): PresentationRuntime {
  const itemIndexById = new Map<string, number>();
  const slideLocationById = new Map<string, SlideLocation>();
  const navigableSlideIds: string[] = [];
  const normalizedItems: PresentationItem[] = [];

  items.forEach((item, itemIndex) => {
    // Un id duplicado haría imposible resolver la posición: se descarta el
    // duplicado en lugar de producir un runtime ambiguo.
    if (itemIndexById.has(item.id)) return;

    const slidesAlreadyNormalized = item.slides.every(
      (slide, slideIndex) => slide.itemId === item.id && slide.order === slideIndex,
    );
    const slides = slidesAlreadyNormalized
      ? item.slides
      : item.slides.map((slide, slideIndex) => ({
          ...slide,
          itemId: item.id,
          order: slideIndex,
        }));

    const normalizedItem: PresentationItem =
      item.order === normalizedItems.length && slides === item.slides
        ? item
        : {
            ...item,
            order: normalizedItems.length,
            slides,
          };

    itemIndexById.set(item.id, normalizedItems.length);
    normalizedItems.push(normalizedItem);

    slides.forEach((slide, slideIndex) => {
      if (slideLocationById.has(slide.id)) return;
      slideLocationById.set(slide.id, {
        itemIndex: normalizedItems.length - 1,
        slideIndex,
        navigableIndex: navigableSlideIds.length,
      });
      navigableSlideIds.push(slide.id);
    });
  });

  return {
    items: Object.freeze(normalizedItems),
    itemIndexById,
    slideLocationById,
    navigableSlideIds: Object.freeze(navigableSlideIds),
  };
}

export const EMPTY_PRESENTATION_RUNTIME: PresentationRuntime = buildPresentationRuntime([]);
