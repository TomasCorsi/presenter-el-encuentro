/**
 * Modelo de runtime del Presentation Engine.
 *
 * Es dominio puro: no importa React, DOM ni APIs del navegador, y puede
 * ejecutarse en servidor, en tests o dentro de una ventana de output.
 */

import type { PresetStyle } from "@/domain/presets/preset";

export interface SlideTextContent {
  kind: "text";
  lines: string[];
}

export type SlideContent = SlideTextContent;

export interface Slide {
  /** `${itemId}:${sectionId}:${chunkIndex}` para contenido derivado. */
  id: string;
  itemId: string;
  /** Orden dentro del item, normalizado a 0..n-1. */
  order: number;
  content: SlideContent;
  /** Etiqueta de origen (Verso 1, Coro…). */
  label?: string | undefined;
  sourceSectionId?: string | undefined;
  /**
   * Estilo YA RESUELTO y congelado por el snapshot de Live (ADR-038). La
   * composición de contenido no lo produce: es opcional antes de resolver y
   * está siempre presente en el runtime que Live carga. El motor solo lo
   * transporta; nunca interpreta ni consulta Presets.
   */
  style?: PresetStyle | undefined;
}

export type PresentationItemType =
  | "song"
  | "bible"
  | "media"
  | "presentation"
  | "countdown"
  | "message";

export interface PresentationItem {
  /** Identidad de ESTA instancia dentro de la presentación. */
  id: string;
  type: PresentationItemType;
  title: string;
  order: number;
  /** Runtime: slides embebidas y ya resueltas, no `slideIds`. */
  slides: Slide[];
  /** Identidad de la entidad original (por ejemplo `song.id`). */
  sourceId?: string | undefined;
  /** Preset pedido por el RundownItem; sin resolver. */
  presetId?: string | undefined;
}

export interface SlideLocation {
  itemIndex: number;
  slideIndex: number;
  /** Posición dentro del recorrido global de slides navegables. */
  navigableIndex: number;
}

/**
 * Datos derivados e inmutables de la presentación. Se construyen únicamente
 * cuando la presentación cambia; nunca son un cache mutable oculto.
 */
export interface PresentationRuntime {
  items: readonly PresentationItem[];
  itemIndexById: ReadonlyMap<string, number>;
  slideLocationById: ReadonlyMap<string, SlideLocation>;
  navigableSlideIds: readonly string[];
}

/**
 * Modo de salida de Program. Es estado operativo, ortogonal al contenido:
 * `clear` y `black` nunca borran `programSlideId` (ADR-024).
 * `logo` llegará con Presets/Media.
 */
export type ProgramMode = "content" | "clear" | "black";

/**
 * Fuente de verdad posicional del motor.
 *
 * Invariantes:
 * 1. `previewItemId` puede apuntar a un item válido aunque no tenga slides.
 * 2. `previewSlideId` es `null` cuando el item seleccionado no tiene slides.
 * 3. Si `previewSlideId !== null`, pertenece siempre a `previewItemId`.
 * 4. Program guarda un único id; su item se deriva del runtime (ADR-022).
 */
export interface PresentationState {
  runtime: PresentationRuntime;
  previewItemId: string | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  programMode: ProgramMode;
}

