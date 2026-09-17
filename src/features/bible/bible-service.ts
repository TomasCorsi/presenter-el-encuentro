import type {
  BibleBookMeta,
  BibleChapter,
  BibleVersionMeta,
  CanonicalBible,
} from "@/domain/bible/bible";
import {
  parseBibleFile,
  type BibleImportAdapter,
  type BibleImportDependencies,
} from "@/domain/bible/import/bible-import";
import { BIBLE_IMPORT_ADAPTERS } from "@/domain/bible/import/usfm-items-adapter";
import type { BibleRepository } from "@/services/bible/bible-repository";

/**
 * Orquesta importación y lectura. La conversión de formato vive en el dominio;
 * aquí solo se coordina con el repositorio.
 */
export class BibleService {
  constructor(
    private readonly repository: BibleRepository,
    private readonly dependencies: BibleImportDependencies,
    private readonly adapters: readonly BibleImportAdapter[] = BIBLE_IMPORT_ADAPTERS,
  ) {}

  async load(): Promise<BibleVersionMeta[]> {
    return this.repository.listVersions();
  }

  /** Lee y convierte SIN instalar: alimenta la vista previa de metadata. */
  parse(text: string): CanonicalBible {
    return parseBibleFile(text, this.adapters, this.dependencies);
  }

  async install(bible: CanonicalBible): Promise<BibleVersionMeta> {
    return this.repository.install(bible);
  }

  async remove(versionId: string): Promise<void> {
    await this.repository.delete(versionId);
  }

  async getBooks(versionId: string): Promise<BibleBookMeta[]> {
    return this.repository.getBooks(versionId);
  }

  async getChapter(
    versionId: string,
    bookUsfm: string,
    chapter: string,
  ): Promise<BibleChapter | null> {
    return this.repository.getChapter(versionId, bookUsfm, chapter);
  }
}
