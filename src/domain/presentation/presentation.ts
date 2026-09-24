/**
 * Modelo de runtime del Presentation Engine.
 *
 * Es dominio puro: no importa React, DOM ni APIs del navegador, y puede
 * ejecutarse en servidor, en tests o dentro de una ventana de output.
 */

import type { PresetStyle } from "@/domain/presets/preset";
import type { MediaKind } from "@/domain/media/media";
import type { RundownBackground } from "@/domain/projects/rundown";

export type ResolvedSlideBackground =
  | { type: "solid"; color: string }
  | {
      type: "media";
      mediaId: string;
      kind: MediaKind;
      fallbackColor: string;
    };

export interface SlideTextContent {
  kind: "text";
  lines: string[];
}

/**
 * Media como contenido presentable (Fase 10): la slide guarda solo la
 * REFERENCIA (`mediaId`). Los bytes nunca cruzan el modelo; cada ventana
 * resuelve la URL local a partir del id.
 */
export interface SlideImageContent {
  kind: "image";
  mediaId: string;
}

export interface SlideVideoContent {
  kind: "video";
  mediaId: string;
}

export type SlideContent = SlideTextContent | SlideImageContent | SlideVideoContent;

/** Líneas de texto de una slide; vacío para contenido no textual. */
export function slideTextLines(content: SlideContent): readonly string[] {
  return content.kind === "text" ? content.lines : [];
}

export interface Slide {
  /** `${itemId}:${sectionId}:${chunkIndex}` para contenido derivado. */
  id: string;
  itemId: string;
  /** Orden dentro del item, normalizado a 0..n-1. */
  order: number;
  content: SlideContent;
  /** Etiqueta de origen (Verso 1, Coro…). Es interna: no se proyecta. */
  label?: string | undefined;
  /**
   * Texto secundario PROYECTABLE, genérico para cualquier tipo de contenido.
   * Bible lo usa para la referencia (`Juan 3:16 · NVI`); las canciones no lo
   * usan hoy. El renderer lo pinta discreto bajo el texto principal.
   */
  secondaryText?: string | undefined;
  sourceSectionId?: string | undefined;
  /**
   * Estilo YA RESUELTO y congelado por el snapshot de Live (ADR-036). La
   * composición de contenido no lo produce: es opcional antes de resolver y
   * está siempre presente en el runtime que Live carga. El motor solo lo
   * transporta; nunca interpreta ni consulta Presets.
   */
  style?: PresetStyle | undefined;
  /** Fondo resuelto y congelado junto con el estilo. */
  background?: ResolvedSlideBackground | undefined;
}

export type PresentationItemType =
  "song" | "bible" | "media" | "presentation" | "countdown" | "message";

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
  /** Referencia persistida antes de resolver el snapshot. */
  background?: RundownBackground | undefined;
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
 * 5. `detachedProgramSlide` y `programSlideId` nunca están activos a la vez.
 */
export interface PresentationState {
  runtime: PresentationRuntime;
  previewItemId: string | null;
  previewSlideId: string | null;
  programSlideId: string | null;
  programMode: ProgramMode;
  /**
   * Copia COMPLETA y renderizable de la slide que estaba al aire cuando su
   * item se quitó del rundown (ADR-045). Mientras existe, Program sigue
   * mostrando exactamente la misma salida sin depender del runtime. Cualquier
   * cambio explícito de contenido (`take`, `goLive`, carga o recarga del show)
   * la descarta.
   */
  detachedProgramSlide: Slide | null;
}
