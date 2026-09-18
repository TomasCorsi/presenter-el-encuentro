import { describe, expect, it } from "bun:test";

import type { BibleBookMeta, BibleVersionMeta } from "@/domain/bible/bible";
import { classifyReferenceInput, parseBibleReference } from "@/domain/bible/bible-reference";
import { resolveBibleVersionSelection } from "@/features/bible/bible-version-selection";

function version(id: string, abbreviation: string): BibleVersionMeta {
  return {
    id,
    abbreviation,
    title: `Biblia ${abbreviation}`,
    language: "es",
    bookCount: 66,
    installedAt: "2026-01-01T00:00:00.000Z",
  };
}

const books: BibleBookMeta[] = [
  { usfm: "JHN", name: "Juan", chapterNumbers: ["1", "2", "3"] },
  { usfm: "PSA", name: "Salmos", chapterNumbers: ["22", "23"] },
  { usfm: "ROM", name: "Romanos", chapterNumbers: ["11", "12"] },
];

describe("selección de traducción en el dock", () => {
  it("con una sola traducción la selecciona y persiste", () => {
    expect(resolveBibleVersionSelection([version("a", "NVI")], null)).toEqual({
      versionId: "a",
      changed: true,
    });
  });

  it("con varias respeta la última elegida", () => {
    const versions = [version("a", "NVI"), version("b", "RVR")];

    expect(resolveBibleVersionSelection(versions, "b")).toEqual({
      versionId: "b",
      changed: false,
    });
  });

  it("si la elegida ya no está instalada cae a la primera", () => {
    const versions = [version("a", "NVI"), version("b", "RVR")];

    expect(resolveBibleVersionSelection(versions, "borrada")).toEqual({
      versionId: "a",
      changed: true,
    });
  });

  it("sin traducciones instaladas no hay selección", () => {
    expect(resolveBibleVersionSelection([], "a")).toEqual({ versionId: null, changed: true });
  });
});

describe("estado de la entrada de referencia", () => {
  it("vacío mientras no se escribe nada", () => {
    expect(classifyReferenceInput("   ", books)).toBe("empty");
  });

  it("no muestra error con una referencia incompleta", () => {
    expect(classifyReferenceInput("Juan", books)).toBe("incomplete");
    expect(classifyReferenceInput("1 Cor", books)).toBe("incomplete");
    expect(classifyReferenceInput("Juan 3:", books)).toBe("incomplete");
  });

  it("marca inválida una referencia formada pero desconocida", () => {
    expect(classifyReferenceInput("Zorro 3:16", books)).toBe("invalid");
    expect(classifyReferenceInput("Juan 99:1", books)).toBe("invalid");
  });

  it("acepta referencias válidas y rangos", () => {
    expect(classifyReferenceInput("Juan 3:16", books)).toBe("valid");
    expect(classifyReferenceInput("Sal 23", books)).toBe("valid");
    expect(classifyReferenceInput("Rom 12:1-3", books)).toBe("valid");

    expect(parseBibleReference("Rom 12:1-3", books)).toMatchObject({
      bookUsfm: "ROM",
      chapter: "12",
      from: "1",
      to: "3",
    });
  });
});
