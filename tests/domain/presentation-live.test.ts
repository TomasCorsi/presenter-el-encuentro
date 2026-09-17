import { describe, expect, it } from "bun:test";

import type { PresentationItem, PresentationState } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
  selectItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import { goLive, nextLive, previousLive } from "@/domain/presentation/presentation-live";
import { setProgramMode, take } from "@/domain/presentation/presentation-program";

function item(id: string, slideCount: number): PresentationItem {
  return {
    id,
    type: "song",
    title: `Item ${id}`,
    order: 0,
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `${id}:s${index}`,
      itemId: id,
      order: index,
      content: { kind: "text" as const, lines: [`línea ${index}`] },
    })),
  };
}

/** Show base: A con 3 slides, B con 2. */
function show(items: PresentationItem[] = [item("a", 3), item("b", 2)]): PresentationState {
  return loadPresentation(createInitialPresentationState(), items);
}

/** Preview + Program en la misma slide. */
function onAir(state: PresentationState, slideId: string): PresentationState {
  return take(selectSlide(state, slideId));
}

describe("nextLive / previousLive", () => {
  it("arrastra Program al avanzar dentro del mismo item", () => {
    const state = nextLive(onAir(show(), "a:s0"));

    expect(state.previewSlideId).toBe("a:s1");
    expect(state.programSlideId).toBe("a:s1");
    expect(state.programMode).toBe("content");
  });

  it("arrastra Program al retroceder dentro del mismo item", () => {
    const state = previousLive(onAir(show(), "a:s1"));

    expect(state.previewSlideId).toBe("a:s0");
    expect(state.programSlideId).toBe("a:s0");
  });

  it("conserva el modo clear al auto-avanzar", () => {
    const state = nextLive(setProgramMode(onAir(show(), "a:s0"), "clear"));

    expect(state.programSlideId).toBe("a:s1");
    expect(state.programMode).toBe("clear");
  });

  it("conserva el modo black al auto-avanzar", () => {
    const state = nextLive(setProgramMode(onAir(show(), "a:s0"), "black"));

    expect(state.programSlideId).toBe("a:s1");
    expect(state.programMode).toBe("black");
  });

  it("no cruza a otro item: Next desde la última slide solo mueve Preview", () => {
    const state = nextLive(onAir(show(), "a:s2"));

    expect(state.previewSlideId).toBe("b:s0");
    expect(state.previewItemId).toBe("b");
    expect(state.programSlideId).toBe("a:s2");
  });

  it("no cruza a otro item: Previous desde la primera slide solo mueve Preview", () => {
    const state = previousLive(onAir(show(), "b:s0"));

    expect(state.previewSlideId).toBe("a:s2");
    expect(state.programSlideId).toBe("b:s0");
  });

  it("no toca Program cuando Preview está en otro item", () => {
    const state = nextLive(selectSlide(onAir(show(), "a:s0"), "b:s0"));

    expect(state.previewSlideId).toBe("b:s1");
    expect(state.programSlideId).toBe("a:s0");
  });

  it("no envía nada cuando no hay Program", () => {
    const state = nextLive(show());

    expect(state.previewSlideId).toBe("a:s1");
    expect(state.programSlideId).toBeNull();
  });

  it("no envía nada desde un item vacío", () => {
    const base = show([item("a", 2), item("empty", 0), item("b", 1)]);
    const state = nextLive(selectItem(onAir(base, "a:s0"), "empty"));

    expect(state.previewItemId).toBe("b");
    expect(state.programSlideId).toBe("a:s0");
  });

  it("no envía nada con una referencia de Program rota", () => {
    const broken: PresentationState = { ...onAir(show(), "a:s0"), programSlideId: "fantasma" };
    const state = nextLive(broken);

    expect(state.previewSlideId).toBe("a:s1");
    expect(state.programSlideId).toBe("fantasma");
  });

  it("TAKE conserva su semántica y fuerza content", () => {
    const state = take(selectSlide(setProgramMode(onAir(show(), "a:s0"), "black"), "b:s0"));

    expect(state.programSlideId).toBe("b:s0");
    expect(state.programMode).toBe("content");
  });

  it("devuelve la misma referencia en los límites globales", () => {
    const first = onAir(show(), "a:s0");
    const last = onAir(show(), "b:s1");

    expect(previousLive(first)).toBe(first);
    expect(nextLive(last)).toBe(last);
  });
});

describe("goLive", () => {
  it("desde content manda la slide al aire y mueve Preview", () => {
    const state = goLive(onAir(show(), "a:s0"), "b:s1");

    expect(state.previewSlideId).toBe("b:s1");
    expect(state.previewItemId).toBe("b");
    expect(state.programSlideId).toBe("b:s1");
    expect(state.programMode).toBe("content");
  });

  it("desde clear vuelve a content y muestra la slide", () => {
    const state = goLive(setProgramMode(onAir(show(), "a:s0"), "clear"), "a:s2");

    expect(state.programSlideId).toBe("a:s2");
    expect(state.programMode).toBe("content");
  });

  it("desde black vuelve a content y muestra la slide", () => {
    const state = goLive(setProgramMode(onAir(show(), "a:s0"), "black"), "a:s2");

    expect(state.programSlideId).toBe("a:s2");
    expect(state.programMode).toBe("content");
  });

  it("vuelve a content aunque se haga clic en la slide que ya estaba al aire", () => {
    const state = goLive(setProgramMode(onAir(show(), "a:s0"), "black"), "a:s0");

    expect(state.programSlideId).toBe("a:s0");
    expect(state.programMode).toBe("content");
  });

  it("es no-op con un id desconocido", () => {
    const base = onAir(show(), "a:s0");

    expect(goLive(base, "fantasma")).toBe(base);
  });
});
