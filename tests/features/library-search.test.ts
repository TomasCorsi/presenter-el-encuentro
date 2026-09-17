import { describe, expect, it } from "bun:test";

import type { Song } from "@/domain/songs/song";
import { searchSongs } from "@/features/live/library-search";

function song(id: string, title: string, author?: string): Song {
  const base: Song = {
    id,
    workspaceId: "local-workspace",
    title,
    sections: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return author ? { ...base, author } : base;
}

const songs = [
  song("1", "Grande es tu fidelidad", "Chisholm"),
  song("2", "Cuán grande es Él"),
  song("3", "Sublime gracia", "Newton"),
];

describe("searchSongs", () => {
  it("sin consulta devuelve todas ordenadas por título", () => {
    expect(searchSongs(songs, "  ").map((s) => s.id)).toEqual(["2", "1", "3"]);
  });

  it("busca por título ignorando acentos y mayúsculas", () => {
    expect(searchSongs(songs, "CUAN").map((s) => s.id)).toEqual(["2"]);
  });

  it("busca por autor", () => {
    expect(searchSongs(songs, "newton").map((s) => s.id)).toEqual(["3"]);
  });

  it("devuelve vacío cuando nada coincide", () => {
    expect(searchSongs(songs, "zzz")).toEqual([]);
  });
});
