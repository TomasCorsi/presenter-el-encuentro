import { clonePassage, passageCaption, type BiblePassage } from "@/domain/bible/bible";

import type { Project } from "./project";
import type { RundownItem, RundownItemFactoryDependencies } from "./rundown";

/** Reordena por `order` y renormaliza a 0..n-1 sin mutar la entrada. */
export function normalizeRundown(items: readonly RundownItem[]): RundownItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

export interface AddSongToRundownInput {
  songId: string;
  title: string;
}

/**
 * Agrega una instancia al final del rundown. No deduplica: repetir la misma
 * canción es un caso válido y esperado.
 */
export function addSongToRundown(
  items: readonly RundownItem[],
  input: AddSongToRundownInput,
  dependencies: RundownItemFactoryDependencies,
): RundownItem[] {
  const normalized = normalizeRundown(items);

  return [
    ...normalized,
    {
      id: dependencies.createId(),
      type: "song",
      sourceId: input.songId,
      title: input.title,
      order: normalized.length,
    },
  ];
}

export interface AddMediaToRundownInput {
  mediaId: string;
  name: string;
}

/**
 * Agrega un archivo de Media al final del rundown. El item guarda solo la
 * REFERENCIA (`sourceId = mediaId`): los bytes nunca se copian al Project,
 * así que eliminar el archivo de la biblioteca queda bloqueado mientras
 * exista esta referencia (Fase 10).
 */
export function addMediaToRundown(
  items: readonly RundownItem[],
  input: AddMediaToRundownInput,
  dependencies: RundownItemFactoryDependencies,
): RundownItem[] {
  const normalized = normalizeRundown(items);

  return [
    ...normalized,
    {
      id: dependencies.createId(),
      type: "media",
      sourceId: input.mediaId,
      title: input.name,
      order: normalized.length,
    },
  ];
}

/**
 * Agrega un pasaje bíblico al final del rundown. El pasaje se guarda COMPLETO
 * dentro del item: desinstalar la traducción no afecta al project (ADR-042).
 */
export function addPassageToRundown(
  items: readonly RundownItem[],
  passage: BiblePassage,
  dependencies: RundownItemFactoryDependencies,
): RundownItem[] {
  const normalized = normalizeRundown(items);
  const frozen = clonePassage(passage);

  return [
    ...normalized,
    {
      id: dependencies.createId(),
      type: "bible",
      sourceId: `${frozen.versionId}:${frozen.bookUsfm}.${frozen.chapter}`,
      title: passageCaption(frozen),
      order: normalized.length,
      payload: { kind: "bible", passage: frozen },
    },
  ];
}

/** Elimina solo esa instancia; otras instancias de la misma fuente permanecen. */
export function removeRundownItem(items: readonly RundownItem[], itemId: string): RundownItem[] {
  return normalizeRundown(items.filter((item) => item.id !== itemId));
}

/** Mueve una instancia una posición; en los extremos es no-op. */
export function moveRundownItem(
  items: readonly RundownItem[],
  itemId: string,
  direction: "up" | "down",
): RundownItem[] {
  const normalized = normalizeRundown(items);
  const index = normalized.findIndex((item) => item.id === itemId);
  if (index === -1) return normalized;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= normalized.length) return normalized;

  const current = normalized[index];
  const swapped = normalized[target];
  if (!current || !swapped) return normalized;

  const reordered = [...normalized];
  reordered[index] = swapped;
  reordered[target] = current;

  return reordered.map((item, position) => ({ ...item, order: position }));
}

/** Duplica el rundown generando nuevas identidades de instancia. */
export function duplicateRundown(
  items: readonly RundownItem[],
  dependencies: RundownItemFactoryDependencies,
): RundownItem[] {
  return normalizeRundown(items).map((item) => ({ ...item, id: dependencies.createId() }));
}

export interface SongUsage {
  /** Número total de apariciones, contando repeticiones. */
  occurrences: number;
  /** Nombres de los projects que la utilizan, sin repetir. */
  projectNames: string[];
}

/**
 * Regla pura de uso. Se calcula en la capa de composición (route) y se pasa a
 * la UI de Songs por props: Songs no depende de la persistencia de Projects.
 */
export function findSongUsage(projects: readonly Project[], songId: string): SongUsage {
  let occurrences = 0;
  const projectNames: string[] = [];

  for (const project of projects) {
    const matches = project.rundown.filter(
      (item) => item.type === "song" && item.sourceId === songId,
    ).length;

    if (matches > 0) {
      occurrences += matches;
      projectNames.push(project.name);
    }
  }

  return { occurrences, projectNames };
}

/**
 * Asigna (o quita, con `undefined`) el Preset de UNA aparición del rundown.
 * No toca la Song ni las demás apariciones de la misma fuente (ADR-034).
 */
export function setRundownItemPreset(
  items: readonly RundownItem[],
  itemId: string,
  presetId: string | undefined,
): RundownItem[] {
  return normalizeRundown(items).map((item) => {
    if (item.id !== itemId) return item;
    const next: RundownItem = { ...item };
    if (presetId) next.presetId = presetId;
    else delete next.presetId;
    return next;
  });
}
