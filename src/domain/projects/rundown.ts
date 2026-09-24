import type { BiblePassage } from "@/domain/bible/bible";

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

/**
 * Contenido AUTOSUFICIENTE de la aparición, para tipos sin entidad editable en
 * la biblioteca. Un pasaje bíblico guarda aquí su texto completo, así que el
 * project sigue funcionando aunque la traducción se elimine (ADR-042).
 */
export type RundownItemPayload = { kind: "bible"; passage: BiblePassage };

/** Override Media de fondo para una aparicion Song/Bible. */
export interface RundownMediaBackground {
  type: "media";
  mediaId: string;
}

export type RundownBackground = RundownMediaBackground;

export interface RundownItem {
  /** Identidad de ESTA instancia dentro del project. */
  id: string;
  /** Hoy se crean items de tipo "song" y "bible". */
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
  /** Fondo Media de ESTA aparicion. Ausente = fondo solido del Preset. */
  background?: RundownBackground | undefined;
  /** Contenido congelado de la aparición (Bible). Ausente en canciones. */
  payload?: RundownItemPayload | undefined;
}

export interface RundownItemFactoryDependencies {
  createId: () => string;
}
