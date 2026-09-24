import { describe, expect, it } from "bun:test";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { createInitialPresentationState, loadPresentation, selectSlide } from "@/domain/presentation/presentation-engine";
import { goLive } from "@/domain/presentation/presentation-live";
import { isMediaRemovalBlocked, toggleProgramMode } from "@/domain/presentation/presentation-program";

function slide(id: string, content: Slide["content"]): Slide {
  return { id, content } as Slide;
}
const items: PresentationItem[] = [
  { id: "img", type: "media", title: "Foto", order: 0, slides: [slide("s-img", { kind: "image", mediaId: "m1" })] },
  { id: "vid", type: "media", title: "Clip", order: 1, slides: [slide("s-vid", { kind: "video", mediaId: "m2" })] },
  { id: "song", type: "song", title: "Canción", order: 2, slides: [slide("s-song", { kind: "text", lines: ["a"] })] },
];

function loaded() {
  return loadPresentation(createInitialPresentationState(), { id: "p", title: "P", items } as never);
}

describe("Media al aire no se puede quitar (Fase 10)", () => {
  it("imagen en Program → bloqueado", () => {
    const s = goLive(loaded(), "s-img");
    expect(isMediaRemovalBlocked(s, "img")).toBe(true);
    expect(isMediaRemovalBlocked(s, "vid")).toBe(false);
  });
  it("video en Program → bloqueado también en Clear/Black", () => {
    const s = goLive(loaded(), "s-vid");
    expect(isMediaRemovalBlocked(s, "vid")).toBe(true);
    expect(isMediaRemovalBlocked(toggleProgramMode(s, "clear"), "vid")).toBe(true);
    expect(isMediaRemovalBlocked(toggleProgramMode(s, "black"), "vid")).toBe(true);
  });
  it("cambiar Program → quitar permitido", () => {
    const s = goLive(goLive(loaded(), "s-vid"), "s-song");
    expect(isMediaRemovalBlocked(s, "vid")).toBe(false);
  });
  it("Songs al aire no se bloquean (ADR-045) y Preview no bloquea", () => {
    const s = goLive(loaded(), "s-song");
    expect(isMediaRemovalBlocked(s, "song")).toBe(false);
    expect(isMediaRemovalBlocked(selectSlide(s, "s-img"), "img")).toBe(false);
  });
});
