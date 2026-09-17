import type { BibleBookMeta, BibleChapter, BiblePassage, BibleVerse, BibleVersionMeta } from "./bible";

/**
 * Referencias bíblicas: parseo, formato y construcción de pasajes.
 * Fase 9: SOLO búsqueda por referencia; no hay búsqueda de texto completo.
 */

export interface BibleReferenceQuery {
  bookUsfm: string;
  bookName: string;
  chapter: string;
  /** Primer versículo del rango; ausente = capítulo completo. */
  from?: string | undefined;
  /** Último versículo del rango; ausente = solo `from`. */
  to?: string | undefined;
}

/** Minúsculas, sin acentos, sin puntos y con espacios colapsados. */
export function normalizeReferenceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Valor numérico del número de versículo ("3", "3-4" → 3). */
export function verseNumberValue(number: string): number {
  const match = /\d+/.exec(number);
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}

function findBook(books: readonly BibleBookMeta[], rawName: string): BibleBookMeta | null {
  const name = normalizeReferenceText(rawName);
  if (!name) return null;

  const byUsfm = books.find((book) => normalizeReferenceText(book.usfm) === name);
  if (byUsfm) return byUsfm;

  const exact = books.find((book) => normalizeReferenceText(book.name) === name);
  if (exact) return exact;

  const prefixed = books.filter((book) => normalizeReferenceText(book.name).startsWith(name));
  if (prefixed.length === 1) return prefixed[0] ?? null;

  // Último recurso: abreviaturas contraídas como "jn" → "juan". Solo vale si
  // una única coincidencia es posible, para no adivinar.
  const contracted = books.filter((book) => isSubsequence(name, normalizeReferenceText(book.name)));
  return contracted.length === 1 ? (contracted[0] ?? null) : null;
}

/** ¿Aparecen todas las letras de `query`, en orden, dentro de `target`? */
function isSubsequence(query: string, target: string): boolean {
  let index = 0;
  for (const character of target) {
    if (character === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return index === query.length;
}

/**
 * Acepta `Juan 3`, `Juan 3:16`, `jn 3:16-18`, `1 Cor 13:4`.
 * Devuelve `null` cuando el libro no existe o la forma no se reconoce.
 */
export function parseBibleReference(
  query: string,
  books: readonly BibleBookMeta[],
): BibleReferenceQuery | null {
  const cleaned = query.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const match = /^(.+?)\s*(\d+)\s*(?::\s*(\d+)\s*(?:-\s*(\d+))?)?$/.exec(cleaned);
  if (!match) return null;

  const [, rawBook, chapter, from, to] = match;
  if (!rawBook || !chapter) return null;

  const book = findBook(books, rawBook);
  if (!book) return null;
  if (!book.chapterNumbers.includes(chapter)) return null;

  const reference: BibleReferenceQuery = {
    bookUsfm: book.usfm,
    bookName: book.name,
    chapter,
  };
  if (from) reference.from = from;
  if (to) reference.to = to;

  return reference;
}

export function formatReference(
  bookName: string,
  chapter: string,
  verses: readonly BibleVerse[],
): string {
  if (verses.length === 0) return `${bookName} ${chapter}`;
  const first = verses[0]?.number ?? "";
  const last = verses[verses.length - 1]?.number ?? "";
  return first === last
    ? `${bookName} ${chapter}:${first}`
    : `${bookName} ${chapter}:${first}-${last}`;
}

export interface BuildPassageInput {
  version: BibleVersionMeta;
  book: BibleBookMeta;
  chapter: BibleChapter;
  /** Números seleccionados; vacío = capítulo completo. */
  verseNumbers?: readonly string[] | undefined;
}

/**
 * Construye el pasaje autosuficiente que se guarda en el rundown.
 * Devuelve `null` si la selección no contiene ningún versículo real.
 */
export function buildPassage({
  version,
  book,
  chapter,
  verseNumbers,
}: BuildPassageInput): BiblePassage | null {
  const wanted = verseNumbers && verseNumbers.length > 0 ? new Set(verseNumbers) : null;
  const verses = chapter.verses
    .filter((verse) => (wanted ? wanted.has(verse.number) : true))
    .map((verse) => ({ number: verse.number, lines: [...verse.lines] }));

  if (verses.length === 0) return null;

  return {
    versionId: version.id,
    versionAbbreviation: version.abbreviation,
    bookUsfm: book.usfm,
    bookName: book.name,
    chapter: chapter.number,
    reference: formatReference(book.name, chapter.number, verses),
    verses,
  };
}

/** Números de versículo comprendidos entre dos selecciones, inclusive. */
export function verseRange(
  verses: readonly BibleVerse[],
  anchor: string,
  focus: string,
): string[] {
  const anchorIndex = verses.findIndex((verse) => verse.number === anchor);
  const focusIndex = verses.findIndex((verse) => verse.number === focus);
  if (anchorIndex === -1 || focusIndex === -1) return [];

  const start = Math.min(anchorIndex, focusIndex);
  const end = Math.max(anchorIndex, focusIndex);
  return verses.slice(start, end + 1).map((verse) => verse.number);
}
