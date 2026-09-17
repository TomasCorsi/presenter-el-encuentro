import { passageCaption, type BiblePassage } from "@/domain/bible/bible";

import type { PresentationItem, Slide } from "./presentation";

export interface PassageToPresentationOptions {
  itemId: string;
  order?: number;
}

/**
 * Transformación pura BiblePassage → PresentationItem.
 *
 * UN VERSÍCULO = UNA SLIDE (ADR-041). Las líneas del original se conservan tal
 * cual y la referencia viaja como texto secundario proyectable.
 *
 * Solo lee el pasaje ya guardado: no consulta el BibleRepository ni necesita
 * que la traducción siga instalada (ADR-042).
 */
export function passageToPresentationItem(
  passage: BiblePassage,
  options: PassageToPresentationOptions,
): PresentationItem {
  const caption = passageCaption(passage);

  const slides: Slide[] = passage.verses
    .filter((verse) => verse.lines.some((line) => line.trim() !== ""))
    .map((verse, index) => ({
      id: `${options.itemId}:${passage.bookUsfm}.${passage.chapter}.${verse.number}:0`,
      itemId: options.itemId,
      order: index,
      content: { kind: "text" as const, lines: [...verse.lines] },
      label: `${passage.bookName} ${passage.chapter}:${verse.number}`,
      secondaryText: `${passage.bookName} ${passage.chapter}:${verse.number} · ${passage.versionAbbreviation}`,
    }));

  return {
    id: options.itemId,
    type: "bible",
    title: caption,
    order: options.order ?? 0,
    slides,
    sourceId: `${passage.versionId}:${passage.bookUsfm}.${passage.chapter}`,
  };
}
