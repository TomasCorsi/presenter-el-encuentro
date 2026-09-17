import type { Project } from "@/domain/projects/project";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";

import type { PresentationItem } from "./presentation";
import { songToPresentationItem } from "./song-to-presentation";

/**
 * Item de presentación para una referencia rota o un tipo todavía no
 * implementado: se conserva la posición, sin inventar contenido. El motor ya
 * sabe saltar items sin slides (Fase 4).
 */
function toPlaceholderItem(item: RundownItem, order: number): PresentationItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    order,
    slides: [],
    sourceId: item.sourceId,
    presetId: item.presetId,
  };
}

/**
 * Transformación pura Project Rundown + biblioteca → PresentationItem[].
 * NO conoce los Presets: propaga `presetId` sin resolverlo. La resolución del
 * estilo ocurre en el snapshot de Live (ADR-038).
 * `PresentationItem.id` es la identidad de instancia del RundownItem, así que
 * la misma Song puede repetirse sin colisiones de IDs de slide.
 */
export function projectToPresentation(
  project: Project,
  songs: readonly Song[],
): PresentationItem[] {
  const songsById = new Map(songs.map((song) => [song.id, song]));

  return [...project.rundown]
    .sort((a, b) => a.order - b.order)
    .map((item, order) => {
      if (item.type !== "song") return toPlaceholderItem(item, order);

      const song = songsById.get(item.sourceId);
      if (!song) return toPlaceholderItem(item, order);

      return {
        ...songToPresentationItem(song, { itemId: item.id, order }),
        presetId: item.presetId,
      };
    });
}
