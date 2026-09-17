import { describe, expect, it } from "bun:test";

import {
  songToPresentationItem,
  toSlideLines,
} from "@/domain/presentation/song-to-presentation";
import type { Song, SongSection } from "@/domain/songs/song";

function section(id: string, label: string, content: string, order: number): SongSection {
  return { id, type: "verse", label, content, order };
}

function song(sections: SongSection[]): Song {
  return {
    id: "song-1",
    workspaceId: "local-workspace",
    title: "Grande es tu fidelidad",
    author: "Autor X",
    sections,
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
  };
}

describe("toSlideLines", () => {
  it("recorta líneas en blanco al inicio y al final", () => {
    expect(toSlideLines("\n\n  uno  \ndos\n\n")).toEqual(["  uno", "dos"]);
  });

  it("devuelve lista vacía con contenido en blanco", () => {
    expect(toSlideLines("   \n \n")).toEqual([]);
  });
});

describe("songToPresentationItem", () => {
  const base = song([
    section("sec-1", "Verso 1", "línea 1\nlínea 2", 0),
    section("sec-2", "Coro", "coro", 1),
  ]);

  it("convierte cada sección con contenido en una slide", () => {
    const item = songToPresentationItem(base, { itemId: "inst-1" });

    expect(item.id).toBe("inst-1");
    expect(item.sourceId).toBe("song-1");
    expect(item.type).toBe("song");
    expect(item.title).toBe("Grande es tu fidelidad");
    expect(item.slides.map((slide) => slide.id)).toEqual([
      "inst-1:sec-1:0",
      "inst-1:sec-2:0",
    ]);
    expect(item.slides[0]?.content.lines).toEqual(["línea 1", "línea 2"]);
    expect(item.slides[0]?.label).toBe("Verso 1");
  });

  it("es determinista con el mismo itemId", () => {
    const first = songToPresentationItem(base, { itemId: "inst-1" });
    const second = songToPresentationItem(base, { itemId: "inst-1" });

    expect(first).toEqual(second);
  });

  it("no colisiona al repetir la misma canción con otro itemId", () => {
    const a = songToPresentationItem(base, { itemId: "inst-1" });
    const b = songToPresentationItem(base, { itemId: "inst-2" });

    expect(a.sourceId).toBe(b.sourceId);
    for (const slide of a.slides) {
      expect(b.slides.some((other) => other.id === slide.id)).toBe(false);
    }
  });

  it("respeta el orden de las secciones", () => {
    const desordenada = song([
      section("sec-2", "Coro", "coro", 1),
      section("sec-1", "Verso 1", "verso", 0),
    ]);

    const item = songToPresentationItem(desordenada, { itemId: "inst-1" });
    expect(item.slides.map((slide) => slide.sourceSectionId)).toEqual(["sec-1", "sec-2"]);
    expect(item.slides.map((slide) => slide.order)).toEqual([0, 1]);
  });

  it("omite secciones vacías", () => {
    const conVacia = song([
      section("sec-1", "Verso 1", "verso", 0),
      section("sec-2", "Coro", "   ", 1),
    ]);

    const item = songToPresentationItem(conVacia, { itemId: "inst-1" });
    expect(item.slides).toHaveLength(1);
  });

  it("produce un item sin slides cuando la canción no tiene secciones", () => {
    const item = songToPresentationItem(song([]), { itemId: "inst-1" });

    expect(item.slides).toHaveLength(0);
  });
});
