import type {
  BibleBookMeta,
  BibleChapter,
  BibleVersionMeta,
  CanonicalBible,
} from "@/domain/bible/bible";

import { chapterKey, type BibleRepository } from "./bible-repository";

/**
 * Implementación en memoria con la MISMA semántica que IndexedDB. La usan los
 * tests y cualquier entorno sin navegador.
 */
export function createInMemoryBibleRepository(): BibleRepository {
  const versions = new Map<string, BibleVersionMeta>();
  const books = new Map<string, BibleBookMeta[]>();
  const chapters = new Map<string, BibleChapter>();

  return {
    async listVersions() {
      return [...versions.values()].map((version) => ({ ...version }));
    },
    async getVersion(versionId) {
      const version = versions.get(versionId);
      return version ? { ...version } : null;
    },
    async getBooks(versionId) {
      return (books.get(versionId) ?? []).map((book) => ({
        ...book,
        chapterNumbers: [...book.chapterNumbers],
      }));
    },
    async getChapter(versionId, bookUsfm, chapter) {
      const found = chapters.get(chapterKey(versionId, bookUsfm, chapter));
      if (!found) return null;
      return {
        ...found,
        verses: found.verses.map((verse) => ({ ...verse, lines: [...verse.lines] })),
      };
    },
    async install(bible: CanonicalBible) {
      await this.delete(bible.meta.id);
      versions.set(bible.meta.id, { ...bible.meta });
      books.set(bible.meta.id, bible.books.map((book) => ({ ...book })));
      for (const chapter of bible.chapters) {
        chapters.set(chapterKey(bible.meta.id, chapter.bookUsfm, chapter.number), chapter);
      }
      return { ...bible.meta };
    },
    async delete(versionId) {
      versions.delete(versionId);
      books.delete(versionId);
      for (const key of [...chapters.keys()]) {
        if (key.startsWith(`${versionId}|`)) chapters.delete(key);
      }
    },
  };
}
