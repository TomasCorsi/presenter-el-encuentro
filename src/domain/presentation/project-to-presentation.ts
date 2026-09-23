import { isBiblePassage } from "@/domain/bible/bible";
import type { MediaAsset } from "@/domain/media/media";
import type { Project } from "@/domain/projects/project";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";

import { mediaToPresentationItem } from "./media-to-presentation";
import { passageToPresentationItem } from "./passage-to-presentation";
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
 * La metadata de Media llega como parámetro (sin consultar storage): un item
 * cuyo asset falta produce un placeholder que conserva su posición, nunca un
 * error ni una referencia inventada.
 */
export function projectToPresentation(
  project: Project,
  songs: readonly Song[],
  media: readonly MediaAsset[] = [],
): PresentationItem[] {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  return [...project.rundown]
    .sort((a, b) => a.order - b.order)
    .map((item, order) => {
      if (item.type === "bible") {
        // El pasaje viaja dentro del item: NO se consulta BibleRepository, así
        // que desinstalar la traducción no rompe el show (ADR-042). Solo un
        // payload ausente o corrupto cuenta como contenido faltante.
        const passage = item.payload?.kind === "bible" ? item.payload.passage : null;
        if (!passage || !isBiblePassage(passage)) return toPlaceholderItem(item, order);

        return {
          ...passageToPresentationItem(passage, { itemId: item.id, order }),
          presetId: item.presetId,
        };
      }

      if (item.type === "media") {
        const asset = mediaById.get(item.sourceId);
        if (!asset) return toPlaceholderItem(item, order);
        return {
          ...mediaToPresentationItem(asset, { itemId: item.id, order }),
          presetId: item.presetId,
        };
      }

      if (item.type !== "song") return toPlaceholderItem(item, order);

      const song = songsById.get(item.sourceId);
      if (!song) return toPlaceholderItem(item, order);

      return {
        ...songToPresentationItem(song, { itemId: item.id, order }),
        presetId: item.presetId,
      };
    });
}
