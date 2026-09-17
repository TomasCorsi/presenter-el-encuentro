import { describe, expect, it } from "bun:test";

import type { CanonicalBible } from "@/domain/bible/bible";
import { createInMemoryBibleRepository } from "@/services/bible/in-memory-bible-repository";

function bible(id: string, abbreviation: string): CanonicalBible {
  return {
    meta: {
      id, abbreviation, title: `Biblia ${abbreviation}`, language: "español",
      bookCount: 1, installedAt: "2026-01-01T00:00:00.000Z",
    },
    books: [{ usfm: "JHN", name: "Juan", chapterNumbers: ["3"] }],
    chapters: [
      {
        versionId: id, bookUsfm: "JHN", number: "3",
        verses: [{ number: "16", lines: ["Porque tanto amó Dios al mundo"] }],
      },
    ],
  };
}

describe("repositorio de Biblias", () => {
  it("instala, lista y lee por capítulo", async () => {
    const repository = createInMemoryBibleRepository();
    await repository.install(bible("128", "NVI"));

    expect((await repository.listVersions()).map((version) => version.abbreviation)).toEqual(["NVI"]);
    expect(await repository.getBooks("128")).toHaveLength(1);
    expect((await repository.getChapter("128", "JHN", "3"))?.verses[0]?.number).toBe("16");
    expect(await repository.getChapter("128", "JHN", "4")).toBeNull();
  });

  it("reinstalar reemplaza la versión sin duplicarla", async () => {
    const repository = createInMemoryBibleRepository();
    await repository.install(bible("128", "NVI"));
    await repository.install(bible("128", "NVI2"));

    const versions = await repository.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.abbreviation).toBe("NVI2");
  });

  it("eliminar una traducción borra su metadata, libros y capítulos", async () => {
    const repository = createInMemoryBibleRepository();
    await repository.install(bible("128", "NVI"));
    await repository.install(bible("129", "RVR"));
    await repository.delete("128");

    expect(await repository.getVersion("128")).toBeNull();
    expect(await repository.getBooks("128")).toEqual([]);
    expect(await repository.getChapter("128", "JHN", "3")).toBeNull();
    expect((await repository.listVersions()).map((version) => version.id)).toEqual(["129"]);
  });
});
