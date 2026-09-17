/**
 * Modelo canónico de Bible.
 *
 * Dominio puro: no conoce el formato de los archivos importados, ni IndexedDB,
 * ni React, ni Live. Los adaptadores de importación traducen CUALQUIER formato
 * externo a estos tipos (ADR-039).
 */

export interface BibleVersionMeta {
  /** Identidad interna de la traducción instalada. */
  id: string;
  /** Identificador del archivo de origen, solo como metadata. */
  externalId?: string | undefined;
  abbreviation: string;
  title: string;
  language: string;
  publisher?: string | undefined;
  copyright?: string | undefined;
  bookCount: number;
  installedAt: string;
}

export interface BibleVerse {
  /** Número tal cual viene del origen: puede ser "3" o "3-4". */
  number: string;
  /** Los saltos de línea del original se CONSERVAN (ADR-041). */
  lines: string[];
}

export interface BibleBookMeta {
  /** Código USFM, p. ej. `JHN`. */
  usfm: string;
  name: string;
  /** Números de capítulo disponibles, en orden. */
  chapterNumbers: string[];
}

export interface BibleChapter {
  versionId: string;
  bookUsfm: string;
  number: string;
  verses: BibleVerse[];
}

/** Resultado completo de una importación, listo para persistir. */
export interface CanonicalBible {
  meta: BibleVersionMeta;
  books: BibleBookMeta[];
  chapters: BibleChapter[];
}

/**
 * Pasaje YA RESUELTO. Es autosuficiente: contiene el texto, así que un
 * RundownItem que lo guarda sigue funcionando aunque la traducción se elimine
 * del dispositivo (ADR-042).
 */
export interface BiblePassage {
  versionId: string;
  versionAbbreviation: string;
  bookUsfm: string;
  bookName: string;
  chapter: string;
  /** Referencia legible, p. ej. `Juan 3:16-18`. */
  reference: string;
  verses: BibleVerse[];
}

/** `Juan 3:16-18 · NVI`, el texto secundario que se proyecta. */
export function passageCaption(passage: BiblePassage): string {
  return `${passage.reference} · ${passage.versionAbbreviation}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((line) => typeof line === "string");
}

function isVerse(value: unknown): value is BibleVerse {
  if (!value || typeof value !== "object") return false;
  const verse = value as Record<string, unknown>;
  return typeof verse["number"] === "string" && isStringArray(verse["lines"]);
}

/**
 * Validación defensiva del pasaje guardado en un rundown. Solo un payload
 * ausente, inválido o corrupto produce "contenido faltante" (ADR-042).
 */
export function isBiblePassage(value: unknown): value is BiblePassage {
  if (!value || typeof value !== "object") return false;
  const passage = value as Record<string, unknown>;
  return (
    typeof passage["versionId"] === "string" &&
    typeof passage["versionAbbreviation"] === "string" &&
    typeof passage["bookUsfm"] === "string" &&
    typeof passage["bookName"] === "string" &&
    typeof passage["chapter"] === "string" &&
    typeof passage["reference"] === "string" &&
    Array.isArray(passage["verses"]) &&
    passage["verses"].length > 0 &&
    passage["verses"].every(isVerse)
  );
}

export function clonePassage(passage: BiblePassage): BiblePassage {
  return {
    ...passage,
    verses: passage.verses.map((verse) => ({ ...verse, lines: [...verse.lines] })),
  };
}
