import { describe, expect, it } from "bun:test";

import type { PresentationItem } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
  next,
  reloadPresentation,
  selectItem,
} from "@/domain/presentation/presentation-engine";
import {
  setProgramMode,
  take,
  toggleProgramMode,
} from "@/domain/presentation/presentation-program";
import {
  getProgramItem,
  getProgramOutput,
  getProgramSlide,
  isItemInProgram,
  isSlideInProgram,
} from "@/domain/presentation/presentation-selectors";

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

function loaded(items: PresentationItem[]) {
  return loadPresentation(createInitialPresentationState(), items);
}

describe("TAKE", () => {
  const items = [item("a", 2), item("b", 1)];

  it("envía la slide de Preview a Program y fija el modo content", () => {
    const state = take(setProgramMode(loaded(items), "black"));

    expect(state.programSlideId).toBe("a:s0");
    expect(state.programMode).toBe("content");
    expect(getProgramSlide(state)?.id).toBe("a:s0");
    expect(getProgramItem(state)?.id).toBe("a");
  });

  it("no mueve Preview", () => {
    const state = take(loaded(items));

    expect(state.previewSlideId).toBe("a:s0");
    expect(next(state).programSlideId).toBe("a:s0");
  });

  it("es no-op sin slide de Preview", () => {
    const state = selectItem(loaded([item("vacio", 0), item("b", 1)]), "vacio");

    expect(take(state)).toBe(state);
    expect(take(state).programSlideId).toBeNull();
  });

  it("marca la slide y el item al aire", () => {
    const state = take(loaded(items));

    expect(isSlideInProgram(state, "a:s0")).toBe(true);
    expect(isSlideInProgram(state, "a:s1")).toBe(false);
    expect(isItemInProgram(state, "a")).toBe(true);
  });
});

describe("modos de salida", () => {
  const base = take(loaded([item("a", 2)]));

  it("clear y black conservan programSlideId", () => {
    const cleared = setProgramMode(base, "clear");

    expect(cleared.programSlideId).toBe("a:s0");
    expect(getProgramOutput(cleared).slide).toBeNull();
    expect(getProgramOutput(cleared).mode).toBe("clear");
  });

  it("volver a content devuelve la misma slide al aire", () => {
    const back = setProgramMode(setProgramMode(base, "black"), "content");

    expect(getProgramOutput(back).slide?.id).toBe("a:s0");
  });

  it("toggle alterna con content", () => {
    const cleared = toggleProgramMode(base, "clear");
    expect(cleared.programMode).toBe("clear");
    expect(toggleProgramMode(cleared, "clear").programMode).toBe("content");
  });

  it("repetir el mismo modo no cambia el estado", () => {
    expect(setProgramMode(base, "content")).toBe(base);
  });
});

describe("load y reload frente a Program", () => {
  const items = [item("a", 2), item("b", 1)];

  it("loadPresentation descarta Program siempre", () => {
    const state = setProgramMode(take(loaded(items)), "black");
    const reloaded = loadPresentation(state, items);

    expect(reloaded.programSlideId).toBeNull();
    expect(reloaded.programMode).toBe("content");
  });

  it("reloadPresentation conserva Preview y Program cuando siguen existiendo", () => {
    const state = setProgramMode(take(next(loaded(items))), "clear");
    const reloaded = reloadPresentation(state, items);

    expect(reloaded.previewSlideId).toBe("a:s1");
    expect(reloaded.programSlideId).toBe("a:s1");
    expect(reloaded.programMode).toBe("clear");
  });

  it("reloadPresentation anula Program cuando su slide desaparece", () => {
    const state = setProgramMode(take(next(loaded(items))), "black");
    const reloaded = reloadPresentation(state, [item("a", 1)]);

    expect(reloaded.programSlideId).toBeNull();
    expect(reloaded.programMode).toBe("content");
  });
});
