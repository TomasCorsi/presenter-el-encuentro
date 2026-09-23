import type { MediaAsset } from "@/domain/media/media";
import type { PresentationItem } from "@/domain/presentation/presentation";
import { projectToPresentation } from "@/domain/presentation/project-to-presentation";
import { resolvePresentationStyles } from "@/domain/presentation/resolve-presentation-styles";
import type { Preset } from "@/domain/presets/preset";
import { resolvePreset } from "@/domain/presets/preset-resolution";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";

/**
 * Composición del show para Live. Puro y testeable: Live trabaja siempre sobre
 * un SNAPSHOT explícito, nunca sobre la biblioteca en vivo (ADR-023).
 *
 * Desde la Fase 8 el snapshot congela también la apariencia: editar un Preset
 * mientras Live opera NO cambia el show al aire (ADR-038).
 */

export interface LiveSnapshot {
  projectId: string;
  projectName: string;
  items: PresentationItem[];
  /** Firma del origen usada para detectar contenido desactualizado. */
  signature: string;
}

/**
 * Firma barata del origen: `updatedAt` del Project, de las Songs referenciadas
 * y de los Presets efectivos de cada item. No compara contenido en
 * profundidad, así que un guardado sin cambios reales puede producir un falso
 * positivo (riesgo aceptado).
 */
export function presentationSignature(
  project: Project,
  songs: readonly Song[],
  presets: readonly Preset[],
  media: readonly MediaAsset[] = [],
): string {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  const parts = [...project.rundown]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const source =
        item.type === "media" ? (mediaById.get(item.sourceId)?.updatedAt ?? "missing")
        : item.type === "song" ? (songsById.get(item.sourceId)?.updatedAt ?? "missing")
        : "frozen";
      const preset = resolvePreset(item.presetId, presets);
      return [item.id, item.sourceId, source, preset.id, preset.updatedAt].join("@");
    });

  return [project.id, project.updatedAt, ...parts].join("|");
}

export function buildLiveSnapshot(
  project: Project,
  songs: readonly Song[],
  presets: readonly Preset[],
  media: readonly MediaAsset[] = [],
): LiveSnapshot {
  return {
    projectId: project.id,
    projectName: project.name,
    items: resolvePresentationStyles(projectToPresentation(project, songs, media), presets),
    signature: presentationSignature(project, songs, presets, media),
  };
}
