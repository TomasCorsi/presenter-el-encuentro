import { describe, expect, it } from "bun:test";

import type { Song, SongFactoryDependencies } from "@/domain/songs/song";
import {
  SongTitleError,
  addSection,
  createSong,
  defaultSectionLabel,
  duplicateSong,
  filterSongs,
  moveSection,
  normalizeSectionOrder,
  removeSection,
  renameSong,
  updateSection,
} from "@/domain/songs/song-rules";

let idCounter = 0;
const dependencies: SongFactoryDependencies = {
  createId: () => `id-${++idCounter}`,
  now: () => "2026-09-17T10:00:00.000Z",
};

function baseSong(): Song {
  return createSong({ title: "  Grande es tu fidelidad  ", author: "  Autor X  " }, dependencies);
}

describe("createSong", () => {
  it("normaliza título y autor, y asigna workspace local por defecto", () => {
    const song = baseSong();
    expect(song.title).toBe("Grande es tu fidelidad");
    expect(song.author).toBe("Autor X");
    expect(song.workspaceId).toBe("local-workspace");
    expect(song.sections).toEqual([]);
  });

  it("rechaza títulos vacíos y demasiado largos", () => {
    expect(() => createSong({ title: "   " }, dependencies)).toThrow(SongTitleError);
    expect(() => createSong({ title: "x".repeat(121) }, dependencies)).toThrow(SongTitleError);
  });

  it("omite el autor cuando está vacío", () => {
    const song = createSong({ title: "Sin autor", author: "   " }, dependencies);
    expect(song.author).toBeUndefined();
  });
});

describe("renameSong", () => {
  it("valida el nuevo título", () => {
    const song = baseSong();
    expect(() => renameSong(song, " ", dependencies.now)).toThrow(SongTitleError);
    expect(renameSong(song, "Nuevo título", dependencies.now).title).toBe("Nuevo título");
  });
});

describe("labels automáticos", () => {
  it("numera los versos según los existentes", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    song = addSection(song, "verse", dependencies);
    expect(song.sections.map((section) => section.label)).toEqual(["Verso 1", "Verso 2"]);
  });

  it("usa labels fijos para tipos estándar", () => {
    expect(defaultSectionLabel("chorus", [])).toBe("Coro");
    expect(defaultSectionLabel("prechorus", [])).toBe("Pre-coro");
    expect(defaultSectionLabel("bridge", [])).toBe("Puente");
    expect(defaultSectionLabel("intro", [])).toBe("Intro");
    expect(defaultSectionLabel("outro", [])).toBe("Outro");
    expect(defaultSectionLabel("custom", [])).toBe("Sección");
  });
});

describe("operaciones de secciones", () => {
  it("mover solo cambia order, nunca los labels", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    song = addSection(song, "verse", dependencies);
    song = updateSection(song, song.sections[0]!.id, { label: "Estrofa inicial" }, dependencies.now);

    const moved = moveSection(song, song.sections[0]!.id, "down", dependencies.now);
    expect(moved.sections.map((section) => section.label)).toEqual(["Verso 2", "Estrofa inicial"]);
    expect(moved.sections.map((section) => section.order)).toEqual([0, 1]);
  });

  it("mover fuera de rango no modifica la canción", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    expect(moveSection(song, song.sections[0]!.id, "up", dependencies.now).sections).toEqual(song.sections);
  });

  it("eliminar renormaliza order a 0..n-1", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    song = addSection(song, "chorus", dependencies);
    song = addSection(song, "bridge", dependencies);

    const result = removeSection(song, song.sections[0]!.id, dependencies.now);
    expect(result.sections.map((section) => section.order)).toEqual([0, 1]);
    expect(result.sections.map((section) => section.type)).toEqual(["chorus", "bridge"]);
  });

  it("cambiar el tipo sugiere nuevo label solo si el anterior era automático", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    const sectionId = song.sections[0]!.id;

    // Label automático → se reemplaza por el del nuevo tipo.
    const auto = updateSection(song, sectionId, { type: "chorus" }, dependencies.now);
    expect(auto.sections[0]!.label).toBe("Coro");

    // Label personalizado → se conserva.
    song = updateSection(song, sectionId, { label: "Mi estrofa" }, dependencies.now);
    const custom = updateSection(song, sectionId, { type: "bridge" }, dependencies.now);
    expect(custom.sections[0]!.label).toBe("Mi estrofa");
  });

  it("un label vacío repone el label por defecto", () => {
    let song = baseSong();
    song = addSection(song, "chorus", dependencies);
    const result = updateSection(song, song.sections[0]!.id, { label: "   " }, dependencies.now);
    expect(result.sections[0]!.label).toBe("Coro");
  });

  it("normalizeSectionOrder no toca labels", () => {
    const sections = [
      { id: "a", type: "verse" as const, label: "Custom", content: "", order: 5 },
      { id: "b", type: "chorus" as const, label: "Coro", content: "", order: 9 },
    ];
    expect(normalizeSectionOrder(sections)).toEqual([
      { ...sections[0], order: 0 },
      { ...sections[1], order: 1 },
    ]);
  });
});

describe("duplicateSong", () => {
  it("genera nuevos IDs de canción y secciones sin referencias compartidas", () => {
    let song = baseSong();
    song = addSection(song, "verse", dependencies);
    song = addSection(song, "chorus", dependencies);

    const copy = duplicateSong(song, dependencies);
    expect(copy.id).not.toBe(song.id);
    expect(copy.title).toBe("Grande es tu fidelidad — copia");
    expect(copy.sections).toHaveLength(2);
    expect(copy.sections.map((section) => section.id)).not.toContain(song.sections[0]!.id);
    expect(copy.sections[0]).not.toBe(song.sections[0]);

    copy.sections[0]!.content = "modificado";
    expect(song.sections[0]!.content).toBe("");
  });
});

describe("filterSongs", () => {
  it("busca por título y autor sin distinguir mayúsculas", () => {
    const a = createSong({ title: "Alabaré", author: "Marcos Witt" }, dependencies);
    const b = createSong({ title: "Poderoso", author: "Otro" }, dependencies);
    expect(filterSongs([a, b], "marcos")).toEqual([a]);
    expect(filterSongs([a, b], "PODE")).toEqual([b]);
    expect(filterSongs([a, b], "  ")).toHaveLength(2);
  });
});
