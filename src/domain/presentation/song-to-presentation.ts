import type { Song } from "@/domain/songs/song";

import type { PresentationItem, Slide } from "./presentation";

export interface SongToPresentationOptions {
  /**
   * Identidad de ESTA instancia dentro de la presentación. La misma canción
   * puede repetirse en un rundown usando itemIds distintos.
   */
  itemId: string;
  order?: number;
}

/** Normaliza el contenido de una sección a líneas, sin blancos al inicio/fin. */
export function toSlideLines(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd());

  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start]?.trim()) start += 1;
  while (end > start && !lines[end - 1]?.trim()) end -= 1;

  return lines.slice(start, end);
}

/**
 * Transformación pura Song → PresentationItem.
 *
 * Versión 1: una sección = una slide. Dividir por líneas o altura requiere
 * tipografía y tamaño de output (Presets / Outputs), así que se pospone.
 */
export function songToPresentationItem(
  song: Song,
  options: SongToPresentationOptions,
): PresentationItem {
  const sections = [...song.sections].sort((a, b) => a.order - b.order);
  const slides: Slide[] = [];

  for (const section of sections) {
    const lines = toSlideLines(section.content);
    if (lines.length === 0) continue;

    slides.push({
      id: `${options.itemId}:${section.id}:0`,
      itemId: options.itemId,
      order: slides.length,
      content: { kind: "text", lines },
      label: section.label,
      sourceSectionId: section.id,
    });
  }

  return {
    id: options.itemId,
    type: "song",
    title: song.title,
    order: options.order ?? 0,
    slides,
    sourceId: song.id,
  };
}
