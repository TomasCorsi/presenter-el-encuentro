import type { BibleBookMeta, BibleChapter, BibleVerse, CanonicalBible } from "../bible";
import {
  BibleImportError,
  cleanLine,
  type BibleImportAdapter,
  type BibleImportDependencies,
} from "./bible-import";

/**
 * Adaptador del formato `version_id` + `books[] → chapters[] → items[]`.
 *
 * Se descarta todo lo que no sirve para navegar ni para proyectar:
 * `chapter_html`, marcado HTML, enlaces previous/next y metadata duplicada.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Acepta texto o número; descarta valores vacíos o no finitos. */
function asLooseString(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  return asString(value);
}

/** `publisher` puede llegar como texto o como objeto `{ name }`. */
function readPublisher(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct) return direct;
  const record = asRecord(value);
  if (!record) return undefined;
  return asString(record["name"]) ?? asString(record["local_name"]);
}

/** `copyright` puede llegar como texto o como objeto `{ text, html }`: nunca el HTML. */
function readCopyright(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct) return cleanLine(direct) || undefined;
  const record = asRecord(value);
  if (!record) return undefined;
  const text = asString(record["text"]) ?? asString(record["html"]);
  return text ? cleanLine(text) || undefined : undefined;
}

/** `language` puede llegar como texto o como objeto `{ name, iso }`. */
function readLanguage(value: unknown): string {
  const direct = asString(value);
  if (direct) return direct;

  const record = asRecord(value);
  if (!record) return "Desconocido";
  return asString(record["name"]) ?? asString(record["local_name"]) ?? asString(record["iso"]) ?? "Desconocido";
}

/** `JHN.3` → `3`; capítulos no numéricos (intro) se descartan. */
function chapterNumberFromUsfm(usfm: string | undefined): string | null {
  if (!usfm) return null;
  const tail = usfm.split(".").pop() ?? "";
  return /^\d+$/.test(tail) ? String(Number.parseInt(tail, 10)) : null;
}

function readVerses(items: unknown): BibleVerse[] {
  if (!Array.isArray(items)) return [];

  const byNumber = new Map<string, string[]>();
  const order: string[] = [];

  for (const rawItem of items) {
    const item = asRecord(rawItem);
    if (!item) continue;

    const numbers = Array.isArray(item["verse_numbers"])
      ? item["verse_numbers"]
          .map((n) => asLooseString(n))
          .filter((n): n is string => n !== undefined)
      : [];
    if (numbers.length === 0) continue;

    const rawLines = Array.isArray(item["lines"]) ? item["lines"] : [];
    const lines = rawLines
      .filter((line): line is string => typeof line === "string")
      .map(cleanLine)
      .filter((line) => line !== "");
    if (lines.length === 0) continue;

    // Un item con varios números es un versículo combinado ("3-4").
    const number = numbers.length === 1 ? (numbers[0] as string) : `${numbers[0]}-${numbers[numbers.length - 1]}`;

    const existing = byNumber.get(number);
    if (existing) existing.push(...lines);
    else {
      byNumber.set(number, [...lines]);
      order.push(number);
    }
  }

  return order.map((number) => ({ number, lines: byNumber.get(number) ?? [] }));
}

export const usfmItemsBibleAdapter: BibleImportAdapter = {
  formatName: "Biblia JSON (books/chapters/items)",

  canImport(value: unknown): boolean {
    const root = asRecord(value);
    if (!root || !Array.isArray(root["books"])) return false;
    const firstBook = asRecord(root["books"][0]);
    if (!firstBook) return false;
    return "book_usfm" in firstBook || "chapters" in firstBook;
  },

  toCanonical(value: unknown, dependencies: BibleImportDependencies): CanonicalBible {
    const root = asRecord(value);
    if (!root || !Array.isArray(root["books"])) {
      throw new BibleImportError("El archivo no contiene una lista de libros.");
    }

    const books: BibleBookMeta[] = [];
    const chapters: BibleChapter[] = [];
    const versionId = asLooseString(root["version_id"]) ?? dependencies.createId();

    for (const rawBook of root["books"]) {
      const book = asRecord(rawBook);
      if (!book) continue;

      const usfm = asString(book["book_usfm"]) ?? asString(book["usfm"]);
      const name = asString(book["name"]) ?? asString(book["local_title"]) ?? usfm;
      if (!usfm || !name) continue;

      const rawChapters = Array.isArray(book["chapters"]) ? book["chapters"] : [];
      const chapterNumbers: string[] = [];

      for (const rawChapter of rawChapters) {
        const chapter = asRecord(rawChapter);
        if (!chapter) continue;

        const number =
          chapterNumberFromUsfm(asString(chapter["chapter_usfm"])) ??
          chapterNumberFromUsfm(asString(chapter["usfm"]));
        if (!number) continue;

        const verses = readVerses(chapter["items"]);
        if (verses.length === 0) continue;

        chapterNumbers.push(number);
        chapters.push({ versionId, bookUsfm: usfm, number, verses });
      }

      if (chapterNumbers.length === 0) continue;
      books.push({ usfm, name, chapterNumbers });
    }

    if (books.length === 0) {
      throw new BibleImportError(
        "El archivo parece una Biblia, pero no se pudo leer ningún versículo. Revisa que cada capítulo incluya sus versículos con su número y su texto.",
      );
    }

    const abbreviation =
      asString(root["local_abbreviation"]) ?? asString(root["abbreviation"]) ?? "BIB";
    const title =
      asString(root["local_title"]) ?? asString(root["title"]) ?? `Biblia ${abbreviation}`;

    const meta = {
      id: versionId,
      externalId: asLooseString(root["version_id"]),
      abbreviation,
      title,
      language: readLanguage(root["language"]),
      publisher: readPublisher(root["publisher"]),
      copyright: readCopyright(root["copyright"]),
      bookCount: books.length,
      installedAt: dependencies.now(),
    };

    return { meta, books, chapters };
  },
};

export const BIBLE_IMPORT_ADAPTERS: readonly BibleImportAdapter[] = [usfmItemsBibleAdapter];
