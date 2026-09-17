import { describe, expect, it } from "bun:test";

import type { BiblePassage } from "@/domain/bible/bible";
import { passageToPresentationItem } from "@/domain/presentation/passage-to-presentation";
import { projectToPresentation } from "@/domain/presentation/project-to-presentation";
import type { Project } from "@/domain/projects/project";
import type { RundownItem } from "@/domain/projects/rundown";
import { addPassageToRundown } from "@/domain/projects/rundown-rules";

const passage: BiblePassage = {
  versionId: "128",
  versionAbbreviation: "NVI",
  bookUsfm: "JHN",
  bookName: "Juan",
  chapter: "3",
  reference: "Juan 3:16-17",
  verses: [
    { number: "16", lines: ["Porque tanto amó Dios al mundo"] },
    { number: "17", lines: ["Dios no envió a su Hijo", "para condenar al mundo"] },
  ],
};

function project(rundown: RundownItem[]): Project {
  return {
    id: "project-1", workspaceId: "local-workspace", name: "Domingo", rundown,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("pasaje bíblico en la presentación", () => {
  it("convierte un versículo en una slide con su texto secundario", () => {
    const item = passageToPresentationItem(passage, { itemId: "item-1" });

    expect(item.slides).toHaveLength(2);
    expect(item.slides[0]?.content.lines).toEqual(["Porque tanto amó Dios al mundo"]);
    expect(item.slides[0]?.secondaryText).toBe("Juan 3:16 · NVI");
    expect(item.slides[1]?.content.lines).toEqual([
      "Dios no envió a su Hijo",
      "para condenar al mundo",
    ]);
    expect(item.title).toBe("Juan 3:16-17 · NVI");
  });

  it("agrega el pasaje al rundown congelando una copia del texto", () => {
    const items = addPassageToRundown([], passage, { createId: () => "item-1" });
    const stored = items[0]?.payload;

    expect(items[0]).toMatchObject({ id: "item-1", type: "bible", title: "Juan 3:16-17 · NVI" });
    expect(stored?.kind).toBe("bible");
    expect(stored?.passage).not.toBe(passage);
    expect(stored?.passage.verses[0]?.lines).toEqual(["Porque tanto amó Dios al mundo"]);
  });

  it("produce las slides sin consultar ninguna traducción instalada", () => {
    const rundown = addPassageToRundown([], passage, { createId: () => "item-1" });
    // `songs` vacío y sin repositorio de Biblias: el item es autosuficiente.
    const items = projectToPresentation(project(rundown), []);

    expect(items[0]?.type).toBe("bible");
    expect(items[0]?.slides).toHaveLength(2);
    expect(items[0]?.slides[1]?.secondaryText).toBe("Juan 3:17 · NVI");
  });

  it("marca contenido faltante solo si el pasaje guardado está ausente o corrupto", () => {
    const withoutPayload = projectToPresentation(
      project([{ id: "item-1", type: "bible", sourceId: "128:JHN.3", title: "Juan 3", order: 0 }]),
      [],
    );
    expect(withoutPayload[0]?.slides).toHaveLength(0);

    const corrupted = projectToPresentation(
      project([
        {
          id: "item-1", type: "bible", sourceId: "128:JHN.3", title: "Juan 3", order: 0,
          payload: { kind: "bible", passage: { ...passage, verses: [] } },
        },
      ]),
      [],
    );
    expect(corrupted[0]?.slides).toHaveLength(0);
  });

  it("conserva el preset asignado a la aparición", () => {
    const rundown = addPassageToRundown([], passage, { createId: () => "item-1" }).map((item) => ({
      ...item,
      presetId: "preset-a",
    }));
    expect(projectToPresentation(project(rundown), [])[0]?.presetId).toBe("preset-a");
  });
});
