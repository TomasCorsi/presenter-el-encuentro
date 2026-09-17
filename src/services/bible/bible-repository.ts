import type {
  BibleBookMeta,
  BibleChapter,
  BibleVersionMeta,
  CanonicalBible,
} from "@/domain/bible/bible";

/**
 * Acceso a las Biblias instaladas. El texto se lee por capítulo: nunca se
 * carga una traducción completa en memoria.
 */
export interface BibleRepository {
  listVersions(): Promise<BibleVersionMeta[]>;
  getVersion(versionId: string): Promise<BibleVersionMeta | null>;
  getBooks(versionId: string): Promise<BibleBookMeta[]>;
  getChapter(versionId: string, bookUsfm: string, chapter: string): Promise<BibleChapter | null>;
  /** Instala o reemplaza una traducción completa. */
  install(bible: CanonicalBible): Promise<BibleVersionMeta>;
  /** Elimina la traducción. NUNCA toca los Projects (ADR-042). */
  delete(versionId: string): Promise<void>;
}

export function chapterKey(versionId: string, bookUsfm: string, chapter: string): string {
  return `${versionId}|${bookUsfm}|${chapter}`;
}
