import { describe, expect, it } from "bun:test";

import { toOutputSnapshot } from "@/domain/output/output-snapshot";
import type { PresentationItem, PresetStyle } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
  removePresentationItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import { goLive } from "@/domain/presentation/presentation-live";
import { setProgramMode, take } from "@/domain/presentation/presentation-program";
import {
  getProgramItem,
  getProgramOutput,
  getProgramSlide,
  isProgramDetached,
} from "@/domain/presentation/presentation-selectors";

const style: PresetStyle = {
  id: "preset-test",
  name: "Test",
  fontFamily: "sans",
  fontSizeVh: 8,
  textColor: "#ffffff",
  backgroundColor: "#000000",
  textAlign: "center",
  verticalAlign: "middle",
  lineHeight: 1.2,
  uppercase: false,
  shadow: false,
};

function item(id: string, slideCount: number): PresentationItem {
  return {
    id,
    type: "bible",
    title: `Item ${id}`,
    order: 0,
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `${id}:s${index}`,
      itemId: id,
      order: index,
      content: { kind: "text" as const, lines: [`línea ${id}${index}`] },
      secondaryText: `Juan 3:${index + 1} · NVI`,
      style,
    })),
  };
}

const show = loadPresentation(createInitialPresentationState(), [
  item("a", 2),
  item("b", 2),
  item("c", 2),
]);

const onAirB = take(selectSlide(show, "b:s0"));

describe("removePresentationItem", () => {
  it("quita solo ese item y renormaliza el orden", () => {
    const state = removePresentationItem(show, "b");

    expect(state.runtime.items.map((entry) => entry.id)).toEqual(["a", "c"]);
    expect(state.runtime.items.map((entry) => entry.order)).toEqual([0, 1]);
  });

  it("no cambia Program si el item quitado no está al aire", () => {
    const state = removePresentationItem(onAirB, "a");

    expect(state.programSlideId).toBe("b:s0");
    expect(state.detachedProgramSlide).toBeNull();
    expect(state.programMode).toBe("content");
  });

  it("congela la slide al aire cuando se quita su item", () => {
    const state = removePresentationItem(onAirB, "b");

    expect(state.programSlideId).toBeNull();
    expect(state.detachedProgramSlide?.content.lines).toEqual(["línea b0"]);
    expect(state.detachedProgramSlide?.secondaryText).toBe("Juan 3:1 · NVI");
    expect(state.detachedProgramSlide?.style).toEqual(style);
    expect(isProgramDetached(state)).toBe(true);
    expect(getProgramItem(state)).toBeNull();
    expect(state.runtime.items.some((entry) => entry.id === "b")).toBe(false);
  });

  it("la salida es visualmente equivalente antes y después de quitar el item", () => {
    const before = toOutputSnapshot(getProgramOutput(onAirB), "s", 1);
    const after = toOutputSnapshot(getProgramOutput(removePresentationItem(onAirB, "b")), "s", 2);

    expect(after.mode).toBe(before.mode);
    expect(after.slide).toEqual(before.slide!);
  });

  it("reubica la selección en el vecino más cercano", () => {
    const state = removePresentationItem(selectSlide(show, "b:s1"), "b");

    expect(state.previewItemId).toBe("c");
    expect(state.previewSlideId).toBe("c:s0");
  });

  it("Clear y Black siguen funcionando sobre la salida congelada", () => {
    const detached = removePresentationItem(onAirB, "b");

    expect(getProgramOutput(setProgramMode(detached, "clear")).slide).toBeNull();
    expect(getProgramOutput(setProgramMode(detached, "black")).slide).toBeNull();
    expect(getProgramSlide(setProgramMode(detached, "black"))?.id).toBe("b:s0");
  });

  it("goLive y TAKE limpian la salida congelada", () => {
    const detached = removePresentationItem(onAirB, "b");

    const live = goLive(detached, "c:s1");
    expect(live.detachedProgramSlide).toBeNull();
    expect(live.programSlideId).toBe("c:s1");

    const taken = take(selectSlide(detached, "a:s0"));
    expect(taken.detachedProgramSlide).toBeNull();
    expect(taken.programSlideId).toBe("a:s0");
  });
});

describe("goLive y TAKE desde Clear y Black", () => {
  it("goLive vuelve a content desde Clear", () => {
    const state = goLive(setProgramMode(onAirB, "clear"), "c:s0");

    expect(state.programMode).toBe("content");
    expect(state.programSlideId).toBe("c:s0");
  });

  it("goLive vuelve a content desde Black", () => {
    const state = goLive(setProgramMode(onAirB, "black"), "c:s0");

    expect(state.programMode).toBe("content");
    expect(state.programSlideId).toBe("c:s0");
  });

  it("TAKE vuelve a content desde Clear", () => {
    const state = take(selectSlide(setProgramMode(onAirB, "clear"), "c:s0"));

    expect(state.programMode).toBe("content");
    expect(state.programSlideId).toBe("c:s0");
  });

  it("TAKE vuelve a content desde Black", () => {
    const state = take(setProgramMode(onAirB, "black"));

    expect(state.programMode).toBe("content");
    expect(state.programSlideId).toBe("b:s0");
  });
});
