import { describe, expect, it } from "bun:test";

import { buildStageProjection } from "@/domain/output/stage-projection";
import type { PresentationItem, PresentationState, Slide } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
  removePresentationItem,
  selectSlide,
} from "@/domain/presentation/presentation-engine";
import { setProgramMode, take } from "@/domain/presentation/presentation-program";

function slide(itemId: string, id: string, lines: string[], label?: string): Slide {
  return {
    id,
    itemId,
    order: 0,
    content: { kind: "text", lines },
    label,
  };
}

function item(
  id: string,
  type: PresentationItem["type"],
  title: string,
  slides: Slide[],
  order: number,
): PresentationItem {
  return {
    id,
    type,
    title,
    order,
    slides: slides.map((entry, index) => ({ ...entry, itemId: id, order: index })),
  };
}

function loaded(items: PresentationItem[]): PresentationState {
  return loadPresentation(createInitialPresentationState(), items);
}

describe("buildStageProjection", () => {
  it("usa Program y nunca Preview", () => {
    const first = item("song-a", "song", "Canción A", [slide("song-a", "a1", ["A1"]), slide("song-a", "a2", ["A2"])], 0);
    let state = loaded([first]);
    state = take(state);
    state = selectSlide(state, "a2");

    expect(buildStageProjection(state)).toEqual({
      current: expect.objectContaining({ slideId: "a1", itemTitle: "Canción A" }),
      next: expect.objectContaining({ slideId: "a2" }),
    });
  });

  it("cruza items, salta items vacíos y termina sin inventar una cue", () => {
    const song = item("song", "song", "Song", [slide("song", "s1", ["Uno"], "Verso 1")], 0);
    const empty = item("empty", "song", "Vacío", [], 1);
    const bibleSlide = { ...slide("bible", "b1", ["Texto"]), secondaryText: "Juan 1:1 · NVI" };
    const bible = item("bible", "bible", "Juan 1:1", [bibleSlide], 2);
    let state = take(loaded([song, empty, bible]));

    expect(buildStageProjection(state).next).toEqual(
      expect.objectContaining({ slideId: "b1", itemTitle: "Juan 1:1", itemType: "bible" }),
    );

    state = take(selectSlide(state, "b1"));
    expect(buildStageProjection(state).next).toBeNull();
  });

  it("conserva cues en Clear y Black", () => {
    const song = item("song", "song", "Song", [slide("song", "s1", ["Uno"]), slide("song", "s2", ["Dos"])], 0);
    const content = take(loaded([song]));
    const clear = setProgramMode(content, "clear");
    const black = setProgramMode(content, "black");

    expect(buildStageProjection(clear)).toEqual(buildStageProjection(content));
    expect(buildStageProjection(black)).toEqual(buildStageProjection(content));
  });

  it("representa Song, Bible y Media sin estilos ni playback", () => {
    const song = item("song", "song", "Song", [slide("song", "s1", ["Letra"], "Coro")], 0);
    const bible = item("bible", "bible", "Juan", [{ ...slide("bible", "b1", ["Texto"]), secondaryText: "Juan 1:1" }], 1);
    const media = item("media", "media", "Video bienvenida", [{ id: "m1", itemId: "media", order: 0, content: { kind: "video", mediaId: "asset-1" } }], 2);
    let state = take(loaded([song, bible, media]));
    expect(buildStageProjection(state).current).toEqual(expect.objectContaining({ label: "Coro", content: { kind: "text", lines: ["Letra"] } }));
    state = take(selectSlide(state, "b1"));
    expect(buildStageProjection(state).current?.secondaryText).toBe("Juan 1:1");
    state = take(selectSlide(state, "m1"));
    expect(buildStageProjection(state).current?.content).toEqual({ kind: "video", mediaId: "asset-1" });
  });

  it("devuelve vacío sin Program y detached conserva current con next null", () => {
    const song = item("song", "song", "Song", [slide("song", "s1", ["Uno"])], 0);
    const initial = loaded([song]);
    expect(buildStageProjection(initial)).toEqual({ current: null, next: null });

    const detached = removePresentationItem(take(initial), "song");
    expect(buildStageProjection(detached)).toEqual({
      current: expect.objectContaining({
        slideId: "s1",
        itemTitle: "Contenido al aire",
        itemType: null,
      }),
      next: null,
    });
  });
});
