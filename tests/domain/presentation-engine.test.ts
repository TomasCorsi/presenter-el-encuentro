import { describe, expect, it } from "bun:test";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  goToFirst,
  goToLast,
  load,
  next,
  previous,
  reset,
  selectItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import {
  getCurrentItem,
  getCurrentSlide,
  getCurrentSlideIndex,
  getNextSlide,
  getPreviousSlide,
  isEmpty,
} from "@/domain/presentation/presentation-selectors";

function slide(itemId: string, index: number): Slide {
  return {
    id: `${itemId}:s${index}`,
    itemId,
    order: index,
    content: { kind: "text", lines: [`línea ${index}`] },
  };
}

function item(id: string, slideCount: number): PresentationItem {
  return {
    id,
    type: "song",
    title: `Item ${id}`,
    order: 0,
    slides: Array.from({ length: slideCount }, (_, index) => slide(id, index)),
  };
}

function loaded(items: PresentationItem[]) {
  return load(createInitialPresentationState(), items);
}

describe("presentación vacía", () => {
  it("carga vacía y deja la posición en null", () => {
    const state = loaded([]);

    expect(isEmpty(state)).toBe(true);
    expect(state.currentItemId).toBeNull();
    expect(state.currentSlideId).toBeNull();
  });

  it("next, previous, goToFirst y goToLast son no-ops", () => {
    const state = loaded([]);

    expect(next(state)).toBe(state);
    expect(previous(state)).toBe(state);
    expect(goToFirst(state)).toBe(state);
    expect(goToLast(state)).toBe(state);
  });

  it("selección inexistente no cambia el estado", () => {
    const state = loaded([]);

    expect(selectItem(state, "nope")).toBe(state);
    expect(selectSlide(state, "nope")).toBe(state);
  });
});

describe("navegación", () => {
  const items = [item("a", 2), item("b", 2)];

  it("posiciona en la primera slide al cargar", () => {
    const state = loaded(items);

    expect(state.currentItemId).toBe("a");
    expect(state.currentSlideId).toBe("a:s0");
  });

  it("avanza y retrocede dentro del item", () => {
    const state = next(loaded(items));

    expect(state.currentSlideId).toBe("a:s1");
    expect(getCurrentSlideIndex(state)).toBe(1);
    expect(previous(state).currentSlideId).toBe("a:s0");
  });

  it("atraviesa el límite entre items en ambos sentidos", () => {
    const state = next(next(loaded(items)));

    expect(state.currentItemId).toBe("b");
    expect(state.currentSlideId).toBe("b:s0");

    const back = previous(state);
    expect(back.currentItemId).toBe("a");
    expect(back.currentSlideId).toBe("a:s1");
  });

  it("no hace wrap en los extremos", () => {
    const first = goToFirst(loaded(items));
    expect(previous(first)).toBe(first);

    const last = goToLast(loaded(items));
    expect(last.currentSlideId).toBe("b:s1");
    expect(next(last)).toBe(last);
  });

  it("selecciona item y slide de forma explícita", () => {
    const state = selectItem(loaded(items), "b");
    expect(state.currentSlideId).toBe("b:s0");

    const selected = selectSlide(state, "a:s1");
    expect(selected.currentItemId).toBe("a");
    expect(getCurrentItem(selected)?.id).toBe("a");
    expect(getCurrentSlide(selected)?.id).toBe("a:s1");
  });

  it("salta items sin slides durante la navegación", () => {
    const state = loaded([item("a", 1), item("vacio", 0), item("b", 1)]);

    expect(next(state).currentItemId).toBe("b");
    expect(previous(next(state)).currentItemId).toBe("a");
  });

  it("expone next y previous slide derivadas", () => {
    const state = loaded(items);

    expect(getPreviousSlide(state)).toBeNull();
    expect(getNextSlide(state)?.id).toBe("a:s1");
    expect(getNextSlide(goToLast(state))).toBeNull();
  });
});

describe("items sin slides", () => {
  const items = [item("a", 1), item("vacio", 0), item("b", 1)];

  it("permite seleccionar un item vacío con slide null", () => {
    const state = selectItem(loaded(items), "vacio");

    expect(state.currentItemId).toBe("vacio");
    expect(state.currentSlideId).toBeNull();
    expect(getCurrentItem(state)?.id).toBe("vacio");
    expect(getCurrentSlide(state)).toBeNull();
  });

  it("next desde un item vacío busca la primera slide posterior", () => {
    const state = next(selectItem(loaded(items), "vacio"));

    expect(state.currentSlideId).toBe("b:s0");
  });

  it("previous desde un item vacío busca la última slide anterior", () => {
    const state = previous(selectItem(loaded(items), "vacio"));

    expect(state.currentSlideId).toBe("a:s0");
  });

  it("es no-op cuando no hay slides en esa dirección", () => {
    const soloAntes = selectItem(loaded([item("a", 1), item("vacio", 0)]), "vacio");
    expect(next(soloAntes)).toBe(soloAntes);

    const soloDespues = selectItem(loaded([item("vacio", 0), item("b", 1)]), "vacio");
    expect(previous(soloDespues)).toBe(soloDespues);
  });
});

describe("reemplazo y reset", () => {
  it("preserva la slide actual si sigue existiendo", () => {
    const state = next(loaded([item("a", 2), item("b", 1)]));
    const reloaded = load(state, [item("a", 2), item("b", 2)]);

    expect(reloaded.currentSlideId).toBe("a:s1");
  });

  it("cae a la primera slide del item cuando la slide desaparece", () => {
    const state = next(loaded([item("a", 2)]));
    const reloaded = load(state, [item("a", 1)]);

    expect(reloaded.currentItemId).toBe("a");
    expect(reloaded.currentSlideId).toBe("a:s0");
  });

  it("cae a la primera slide navegable cuando el item desaparece", () => {
    const state = loaded([item("a", 1)]);
    const reloaded = load(state, [item("b", 1)]);

    expect(reloaded.currentSlideId).toBe("b:s0");
  });

  it("queda vacío cuando no queda ninguna slide", () => {
    const state = loaded([item("a", 1)]);
    const reloaded = load(state, []);

    expect(reloaded.currentItemId).toBeNull();
    expect(reloaded.currentSlideId).toBeNull();
  });

  it("mantiene el item seleccionado si sobrevive sin slides", () => {
    const state = loaded([item("a", 1)]);
    const reloaded = load(state, [item("a", 0)]);

    expect(reloaded.currentItemId).toBe("a");
    expect(reloaded.currentSlideId).toBeNull();
  });

  it("reset devuelve el estado inicial vacío", () => {
    const state = reset();

    expect(isEmpty(state)).toBe(true);
    expect(state.currentSlideId).toBeNull();
  });

  it("IDs inválidos nunca rompen el estado", () => {
    const state = loaded([item("a", 1)]);

    expect(selectItem(state, "x")).toBe(state);
    expect(selectSlide(state, "x:s9")).toBe(state);
  });
});
