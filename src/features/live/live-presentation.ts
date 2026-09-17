import type { PresentationItem } from "@/domain/presentation/presentation";
import { projectToPresentation } from "@/domain/presentation/project-to-presentation";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";

/**
 * Composición del show para Live. Puro y testeable: Live trabaja siempre sobre
 * un SNAPSHOT explícito, nunca sobre la biblioteca en vivo (ADR-023).
 */

export interface LiveSnapshot {
  projectId: string;
  projectName: string;
  items: PresentationItem[];
  /** Firma del origen usada para detectar contenido desactualizado. */
  signature: string;
}

/**
 * Firma barata del origen: `updatedAt` del Project y de las Songs
 * referenciadas. No compara contenido en profundidad, así que un guardado sin
 * cambios reales puede producir un falso positivo (riesgo aceptado).
 */
export function presentationSignature(project: Project, songs: readonly Song[]): string {
  const songsById = new Map(songs.map((song) => [song.id, song]));

  const parts = [...project.rundown]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const song = songsById.get(item.sourceId);
      return `${item.id}@${item.sourceId}@${song ? song.updatedAt : "missing"}`;
    });

  return [project.id, project.updatedAt, ...parts].join("|");
}

export function buildLiveSnapshot(project: Project, songs: readonly Song[]): LiveSnapshot {
  return {
    projectId: project.id,
    projectName: project.name,
    items: projectToPresentation(project, songs),
    signature: presentationSignature(project, songs),
  };
}
