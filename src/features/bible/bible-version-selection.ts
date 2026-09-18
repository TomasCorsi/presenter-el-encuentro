import type { BibleVersionMeta } from "@/domain/bible/bible";

export interface BibleVersionSelection {
  /** Traducción efectiva; `null` cuando no hay ninguna instalada. */
  versionId: string | null;
  /** La preferencia guardada no servía y hay que reescribirla. */
  changed: boolean;
}

/**
 * Regla única de selección de traducción (Fase 9.2):
 *
 * - sin Biblias instaladas → `null`;
 * - una sola → esa, y se persiste;
 * - varias → la última elegida localmente;
 * - la elegida ya no existe → la primera disponible, y se persiste.
 */
export function resolveBibleVersionSelection(
  versions: readonly BibleVersionMeta[],
  preferredId: string | null,
): BibleVersionSelection {
  if (versions.length === 0) return { versionId: null, changed: preferredId !== null };

  const preferred = preferredId
    ? versions.find((version) => version.id === preferredId)
    : undefined;
  if (preferred) return { versionId: preferred.id, changed: false };

  const fallback = versions[0];
  return { versionId: fallback ? fallback.id : null, changed: true };
}
