/**
 * Un RundownItem representa UNA aparición de contenido dentro de un Project.
 * La misma canción puede aparecer varias veces: cada aparición tiene su propio
 * `id` (identidad de instancia) y comparte `sourceId` (identidad de origen).
 */
export type RundownItemType =
  | "song"
  | "bible"
  | "media"
  | "presentation"
  | "countdown"
  | "message";

export interface RundownItem {
  /** Identidad de ESTA instancia dentro del project. */
  id: string;
  /** En esta fase solo se crean items de tipo "song". */
  type: RundownItemType;
  /** Identidad de la entidad original (song.id). */
  sourceId: string;
  /** Snapshot del título al agregar; fallback si la fuente desaparece. */
  title: string;
  /** Normalizado siempre a 0..n-1. */
  order: number;
  /**
   * Preset visual de ESTA aparición (ADR-034). Ausente = Default Preset, así
   * que la misma Song puede verse distinta en dos apariciones.
   */
  presetId?: string | undefined;
}

export interface RundownItemFactoryDependencies {
  createId: () => string;
}
