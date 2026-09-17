/**
 * Modelo de runtime del Presentation Engine.
 *
 * Es dominio puro: no importa React, DOM ni APIs del navegador, y puede
 * ejecutarse en servidor, en tests o dentro de una ventana de output.
 */

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
 * Fuente de verdad posicional del motor.
 *
 * Invariantes:
 * 1. `currentItemId` puede apuntar a un item válido aunque no tenga slides.
 * 2. `currentSlideId` es `null` cuando el item seleccionado no tiene slides.
 * 3. Si `currentSlideId !== null`, pertenece siempre a `currentItemId`.
 */
export interface PresentationState {
  runtime: PresentationRuntime;
  currentItemId: string | null;
  currentSlideId: string | null;
}
