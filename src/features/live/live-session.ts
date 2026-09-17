import type { PresentationItem } from "@/domain/presentation/presentation";
import { projectToPresentation } from "@/domain/presentation/project-to-presentation";
import { resolvePresentationStyles } from "@/domain/presentation/resolve-presentation-styles";
import type { Preset } from "@/domain/presets/preset";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";

import { buildLiveSnapshot, presentationSignature, type LiveSnapshot } from "./live-presentation";

/**
 * Sesión de Live (ADR-043).
 *
 * El snapshot sigue siendo la fuente del show en operación. La sesión añade
 * una sola cosa: recordar que existe un desfase externo YA CONOCIDO que el
 * operador no ha incorporado.
 *
 * Al agregar contenido desde la biblioteca de Live se adopta la firma nueva
 * (para que la propia alta no genere un falso aviso) pero se conserva el
 * desfase externo pendiente, que solo desaparece con una recarga explícita.
 */
export interface LiveSession {
  snapshot: LiveSnapshot;
  /** Hay cambios externos detectados y no incorporados. */
  staleExternal: boolean;
}

export interface LiveSessionSources {
  project: Project;
  songs: readonly Song[];
  presets: readonly Preset[];
}

export function createLiveSession({ project, songs, presets }: LiveSessionSources): LiveSession {
  return { snapshot: buildLiveSnapshot(project, songs, presets), staleExternal: false };
}

/** Recarga explícita del operador: incorpora TODOS los cambios de las fuentes. */
export function reloadLiveSession(sources: LiveSessionSources): LiveSession {
  return createLiveSession(sources);
}

export function isLiveSessionOutdated(
  session: LiveSession,
  { project, songs, presets }: LiveSessionSources,
): boolean {
  if (session.staleExternal) return true;
  return presentationSignature(project, songs, presets) !== session.snapshot.signature;
}

/**
 * Construye el PresentationItem de UN RundownItem recién creado, con su estilo
 * ya resuelto. No toca el resto del show.
 */
export function buildAppendedItem(
  { project, songs, presets }: LiveSessionSources,
  rundownItemId: string,
): PresentationItem | null {
  const rundownItem = project.rundown.find((item) => item.id === rundownItemId);
  if (!rundownItem) return null;

  const items = projectToPresentation({ ...project, rundown: [rundownItem] }, songs);
  return resolvePresentationStyles(items, presets)[0] ?? null;
}

export interface AppendToLiveSessionInput extends LiveSessionSources {
  item: PresentationItem;
  /** ¿La sesión ya estaba desfasada ANTES de esta alta? */
  wasOutdated: boolean;
}

export function appendToLiveSession(
  session: LiveSession,
  { project, songs, presets, item, wasOutdated }: AppendToLiveSessionInput,
): LiveSession {
  return {
    snapshot: {
      ...session.snapshot,
      items: [...session.snapshot.items, item],
      signature: presentationSignature(project, songs, presets),
    },
    staleExternal: session.staleExternal || wasOutdated,
  };
}
