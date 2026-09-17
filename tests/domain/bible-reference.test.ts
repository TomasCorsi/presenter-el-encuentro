import { describe, expect, it } from "bun:test";

import type { BibleBookMeta, BibleChapter, BibleVersionMeta } from "@/domain/bible/bible";
import { buildPassage, parseBibleReference, verseRange } from "@/domain/bible/bible-reference";

const books: BibleBookMeta[] = [
  { usfm: "JHN", name: "Juan", chapterNumbers: ["1", "3"] },
  { usfm: "1CO", name: "1 Corintios", chapterNumbers: ["13"] },
];

const version: BibleVersionMeta = {
  id: "128",
  abbreviation: "NVI",
  title: "Nueva Versión Internacional",
  language: "español",
  bookCount: 2,
  installedAt: "2026-01-01T00:00:00.000Z",
};

const chapter: BibleChapter = {
  versionId: "128",
  bookUsfm: "JHN",
  number: "3",
  verses: [
    { number: "16", lines: ["Porque tanto amó Dios al mundo"] },
    { number: "17", lines: ["Dios no envió a su Hijo", "para condenar"] },
    { number: "18", lines: ["El que cree no es condenado"] },
  ],
};

describe("referencias bíblicas", () => {
  it("acepta abreviaturas, acentos y rangos", () => {
    expect(parseBibleReference("jn 3:16-18", books)).toEqual({
      bookUsfm: "JHN", bookName: "Juan", chapter: "3", from: "16", to: "18",
    });
    expect(parseBibleReference("JUAN 3", books)).toEqual({
      bookUsfm: "JHN", bookName: "Juan", chapter: "3",
    });
    expect(parseBibleReference("1 cor 13:4", books)?.bookUsfm).toBe("1CO");
  });

  it("devuelve null si el libro o el capítulo no existen", () => {
    expect(parseBibleReference("Marcos 1:1", books)).toBeNull();
    expect(parseBibleReference("Juan 99:1", books)).toBeNull();
    expect(parseBibleReference("", books)).toBeNull();
  });

  it("construye el pasaje con la referencia formateada", () => {
    const passage = buildPassage({ version, book: books[0]!, chapter, verseNumbers: ["16", "17"] });
    expect(passage?.reference).toBe("Juan 3:16-17");
    expect(passage?.versionAbbreviation).toBe("NVI");
    expect(passage?.verses).toHaveLength(2);
  });

  it("sin selección toma el capítulo completo", () => {
    const passage = buildPassage({ version, book: books[0]!, chapter });
    expect(passage?.verses).toHaveLength(3);
    expect(passage?.reference).toBe("Juan 3:16-18");
  });

  it("calcula el rango entre dos versículos en cualquier orden", () => {
    expect(verseRange(chapter.verses, "18", "16")).toEqual(["16", "17", "18"]);
    expect(verseRange(chapter.verses, "16", "16")).toEqual(["16"]);
    expect(verseRange(chapter.verses, "16", "99")).toEqual([]);
  });
});
