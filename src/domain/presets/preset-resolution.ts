import type { Project } from "@/domain/projects/project";

import { DEFAULT_PRESET, type Preset } from "./preset";

/**
 * Resolución tolerante (ADR-034): sin `presetId`, o con un id que ya no existe
 * (preset eliminado, dato corrupto), siempre se devuelve el Default. El
 * sistema nunca queda sin estilo válido.
 */
export function resolvePreset(
  presetId: string | undefined,
  presets: readonly Preset[],
): Preset {
  if (!presetId) return DEFAULT_PRESET;
  return presets.find((preset) => preset.id === presetId) ?? DEFAULT_PRESET;
}

export interface PresetUsage {
  /** Apariciones en rundowns, contando repeticiones. */
  occurrences: number;
  /** Nombres de los projects que lo usan, sin repetir. */
  projectNames: string[];
}

/** Uso de un preset en los rundowns; regla pura, se calcula en la route. */
export function findPresetUsage(
  projects: readonly Project[],
  presetId: string,
): PresetUsage {
  let occurrences = 0;
  const projectNames: string[] = [];

  for (const project of projects) {
    const matches = project.rundown.filter((item) => item.presetId === presetId).length;
    if (matches > 0) {
      occurrences += matches;
      projectNames.push(project.name);
    }
  }

  return { occurrences, projectNames };
}
