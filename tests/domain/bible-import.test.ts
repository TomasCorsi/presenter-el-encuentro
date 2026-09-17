import { describe, expect, it } from "bun:test";

import { BibleImportError, parseBibleFile } from "@/domain/bible/import/bible-import";
import { BIBLE_IMPORT_ADAPTERS } from "@/domain/bible/import/usfm-items-adapter";

const dependencies = { createId: () => "generated-id", now: () => "2026-01-01T00:00:00.000Z" };

function externalBible(overrides: Record<string, unknown> = {}) {
  return {
    version_id: "128",
    local_abbreviation: "NVI",
    local_title: "Nueva Versión Internacional",
    language: { name: "español", iso: "spa" },
    publisher: "Bíblica",
    copyright: "© Bíblica",
    books: [
      {
        book_usfm: "JHN",
        name: "Juan",
        chapters: [
          {
            chapter_usfm: "JHN.3",
            chapter_html: "<div class='chapter'>…</div>",
            items: [
              { type: "verse", verse_numbers: ["16"], lines: ["Porque tanto amó Dios al mundo"] },
              {
                type: "verse",
                verse_numbers: ["17"],
                lines: ["Dios no envió a su Hijo", "para condenar al mundo"],
              },
              { type: "verse", verse_numbers: ["18", "19"], lines: ["<span>El que cree</span>"] },
              { type: "heading", lines: ["Encabezado sin versículo"] },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function parse(value: unknown) {
  return parseBibleFile(JSON.stringify(value), BIBLE_IMPORT_ADAPTERS, dependencies);
}

describe("importación de Biblias", () => {
  it("convierte el formato externo al modelo canónico", () => {
    const bible = parse(externalBible());

    expect(bible.meta).toMatchObject({
      id: "128",
      externalId: "128",
      abbreviation: "NVI",
      title: "Nueva Versión Internacional",
      language: "español",
      publisher: "Bíblica",
      bookCount: 1,
      installedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(bible.books).toEqual([{ usfm: "JHN", name: "Juan", chapterNumbers: ["3"] }]);
  });

  it("conserva los saltos de línea de un versículo multilínea", () => {
    const chapter = parse(externalBible()).chapters[0]!;
    expect(chapter.verses[1]).toEqual({
      number: "17",
      lines: ["Dios no envió a su Hijo", "para condenar al mundo"],
    });
  });

  it("descarta el HTML y los items sin número de versículo", () => {
    const chapter = parse(externalBible()).chapters[0]!;
    expect(chapter.verses.map((verse) => verse.number)).toEqual(["16", "17", "18-19"]);
    expect(JSON.stringify(chapter)).not.toContain("<");
    expect(JSON.stringify(chapter)).not.toContain("chapter_html");
  });

  it("no almacena chapter_html en el resultado", () => {
    expect(JSON.stringify(parse(externalBible()))).not.toContain("chapter_html");
  });

  it("rechaza un JSON inválido", () => {
    expect(() => parseBibleFile("{", BIBLE_IMPORT_ADAPTERS, dependencies)).toThrow(BibleImportError);
  });

  it("rechaza un formato desconocido", () => {
    expect(() => parse({ verses: [] })).toThrow(/no es compatible/i);
  });

  it("rechaza un archivo sin versículos legibles", () => {
    expect(() => parse(externalBible({ books: [{ book_usfm: "JHN", name: "Juan", chapters: [] }] }))).toThrow(
      /ningún versículo/i,
    );
  });

  it("acepta números de versículo numéricos", () => {
    const bible = parse(
      externalBible({
        books: [
          {
            book_usfm: "JHN",
            name: "Juan",
            chapters: [
              {
                chapter_usfm: "JHN.3",
                items: [
                  { type: "verse", verse_numbers: [16], lines: ["Porque tanto amó Dios"] },
                  { type: "verse", verse_numbers: [17, 18], lines: ["Dios no envió a su Hijo"] },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(bible.chapters[0]!.verses.map((verse) => verse.number)).toEqual(["16", "17-18"]);
  });

  it("acepta version_id numérico", () => {
    expect(parse(externalBible({ version_id: 128 })).meta).toMatchObject({
      id: "128",
      externalId: "128",
    });
  });

  it("lee publisher y copyright cuando llegan como objeto", () => {
    const bible = parse(
      externalBible({
        publisher: { name: "Biblica, Inc." },
        copyright: { html: "<p>© 2022 Biblica</p>", text: "© 2022 Biblica" },
      }),
    );
    expect(bible.meta.publisher).toBe("Biblica, Inc.");
    expect(bible.meta.copyright).toBe("© 2022 Biblica");
  });

  it("usa valores por defecto cuando falta metadata opcional", () => {
    const bible = parse(
      externalBible({ version_id: undefined, publisher: undefined, language: undefined }),
    );
    expect(bible.meta.id).toBe("generated-id");
    expect(bible.meta.language).toBe("Desconocido");
    expect(bible.meta.publisher).toBeUndefined();
  });
});
