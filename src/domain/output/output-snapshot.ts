import type { VideoPlaybackState } from "@/domain/output/video-playback";
import type {
  PresentationItemType,
  ProgramMode,
  ResolvedSlideBackground,
} from "@/domain/presentation/presentation";
import type { PresetStyle } from "@/domain/presets/preset";
import { normalizePresetStyle, presetStylesEqual } from "@/domain/presets/preset-rules";
import type { ProgramOutput } from "@/domain/presentation/presentation-selectors";

import { isVideoPlayback } from "./video-playback";

/**
 * Protocolo Output Sync (ADR-028).
 *
 * Dominio puro: sin DOM, sin BroadcastChannel, sin React. Define el contrato
 * de mensajes entre Live (autoridad) y los Outputs (consumidores), y la
 * validación defensiva de todo lo que llega por el canal.
 */

/** Contenido de la slide al aire. Media viaja como REFERENCIA (mediaId). */
export type OutputSlideContent =
  | { kind: "text"; lines: string[] }
  | { kind: "image"; mediaId: string }
  | { kind: "video"; mediaId: string };

/**
 * Contenido Y apariencia RESUELTOS: Output nunca reconstruye nada ni consulta
 * repositories. El estilo llega congelado desde el snapshot de Live (ADR-036).
 * Un `mediaId` NUNCA lleva bytes: Output resuelve su propia URL local.
 */
export interface OutputSlide {
  id: string;
  content: OutputSlideContent;
  /** Línea secundaria proyectable (referencia bíblica, atribución…). */
  secondaryText?: string | undefined;
  style: PresetStyle;
  background: ResolvedSlideBackground;
  /** Solo slides de video: estado de reproducción autoritativo de Live. */
  playback?: VideoPlaybackState | undefined;
}

export type BackgroundTransition = "cut" | "fade";

/** Referencia textual/Media liviana para la salida Stage. */
export interface StageCue {
  slideId: string;
  itemId: string;
  itemTitle: string;
  itemType: PresentationItemType | null;
  label?: string | undefined;
  content: OutputSlideContent;
  secondaryText?: string | undefined;
}

export interface StageProjection {
  current: StageCue | null;
  next: StageCue | null;
}

/** Estado completo que Output necesita para pintar Program. */
export interface OutputSnapshot {
  sessionId: string;
  sequence: number;
  mode: ProgramMode;
  backgroundTransition: BackgroundTransition;
  /** `null` en `clear`, `black` o Program vacío. */
  slide: OutputSlide | null;
  /** Proyección aditiva y read-only para `/output/stage`. */
  stage?: StageProjection | undefined;
}

export type OutputMessage =
  | { type: "hello" }
  | { type: "snapshot"; snapshot: OutputSnapshot }
  | { type: "update"; snapshot: OutputSnapshot }
  | { type: "bye"; sessionId: string };

export const OUTPUT_CHANNEL_NAME = "broadcast-control.output.v1";

export const HEARTBEAT_INTERVAL_MS = 2000;
export const LIVENESS_TIMEOUT_MS = 5000;

/**
 * Deriva el snapshot a publicar a partir de la salida de Program.
 * `playback` es el estado de video de Live; solo se adjunta a slides de
 * video (en una slide de texto o imagen se ignora).
 */
export function toOutputSnapshot(
  output: ProgramOutput,
  sessionId: string,
  sequence: number,
  playback: VideoPlaybackState | null = null,
  backgroundTransition: BackgroundTransition = "cut",
  stage?: StageProjection,
): OutputSnapshot {
  const slide = output.slide;
  const style = normalizePresetStyle(slide?.style);
  return {
    sessionId,
    sequence,
    mode: output.mode,
    backgroundTransition,
    stage,
    slide: slide
      ? {
          id: slide.id,
          content:
            slide.content.kind === "text"
              ? { kind: "text" as const, lines: [...slide.content.lines] }
              : { kind: slide.content.kind, mediaId: slide.content.mediaId },
          secondaryText: slide.secondaryText,
          // El publisher NO resuelve Presets: solo copia el estilo ya
          // congelado en el runtime, con el Default como red de seguridad.
          style,
          background:
            slide.background ?? {
              type: "solid",
              color: style.background.color,
            },
          playback:
            slide.content.kind === "video" && playback ? { ...playback } : undefined,
        }
      : null,
  };
}

function backgroundsEqual(a: ResolvedSlideBackground, b: ResolvedSlideBackground): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "solid" && b.type === "solid") return a.color === b.color;
  if (a.type === "solid" || b.type === "solid") return false;
  return (
    a.mediaId === b.mediaId && a.kind === b.kind && a.fallbackColor === b.fallbackColor
  );
}

function linesEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

function contentsEqual(a: OutputSlideContent, b: OutputSlideContent): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "text" && b.kind === "text") return linesEqual(a.lines, b.lines);
  if (a.kind === "text" || b.kind === "text") return false;
  return a.mediaId === b.mediaId;
}

function cuesEqual(a: StageCue | null, b: StageCue | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.slideId === b.slideId &&
    a.itemId === b.itemId &&
    a.itemTitle === b.itemTitle &&
    a.itemType === b.itemType &&
    (a.label ?? null) === (b.label ?? null) &&
    contentsEqual(a.content, b.content) &&
    (a.secondaryText ?? null) === (b.secondaryText ?? null)
  );
}

function stagesEqual(a?: StageProjection, b?: StageProjection): boolean {
  if (!a || !b) return a === b;
  return cuesEqual(a.current, b.current) && cuesEqual(a.next, b.next);
}

/**
 * Compara TODO lo que Output pinta: modo, id, contenido, estilo y estado de
 * reproducción. De la reproducción basta la revisión: cada cambio de Live la
 * incrementa, así que una revisión distinta implica un snapshot distinto.
 */
export function snapshotsEqual(a: OutputSnapshot, b: OutputSnapshot): boolean {
  if (a.mode !== b.mode) return false;
  if (a.backgroundTransition !== b.backgroundTransition) return false;
  if (!stagesEqual(a.stage, b.stage)) return false;
  if (a.slide === null || b.slide === null) return a.slide === b.slide;
  return (
    a.slide.id === b.slide.id &&
    contentsEqual(a.slide.content, b.slide.content) &&
    (a.slide.secondaryText ?? null) === (b.slide.secondaryText ?? null) &&
    presetStylesEqual(a.slide.style, b.slide.style) &&
    backgroundsEqual(a.slide.background, b.slide.background) &&
    (a.slide.playback?.revision ?? null) === (b.slide.playback?.revision ?? null)
  );
}

function parseBackground(
  value: unknown,
  fallbackColor: string,
): ResolvedSlideBackground {
  if (!value || typeof value !== "object") return { type: "solid", color: fallbackColor };
  const candidate = value as Record<string, unknown>;
  if (candidate["type"] === "solid" && typeof candidate["color"] === "string") {
    return { type: "solid", color: candidate["color"] };
  }
  if (
    candidate["type"] === "media" &&
    typeof candidate["mediaId"] === "string" &&
    candidate["mediaId"] !== "" &&
    (candidate["kind"] === "image" || candidate["kind"] === "video") &&
    typeof candidate["fallbackColor"] === "string"
  ) {
    return {
      type: "media",
      mediaId: candidate["mediaId"],
      kind: candidate["kind"],
      fallbackColor: candidate["fallbackColor"],
    };
  }
  return { type: "solid", color: fallbackColor };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const PRESENTATION_ITEM_TYPES: readonly PresentationItemType[] = [
  "song",
  "bible",
  "media",
  "presentation",
  "countdown",
  "message",
];

function parseStageCue(value: unknown): StageCue | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const content = parseContent(candidate["content"], undefined);
  const itemType = candidate["itemType"];
  if (
    typeof candidate["slideId"] !== "string" ||
    candidate["slideId"] === "" ||
    typeof candidate["itemId"] !== "string" ||
    candidate["itemId"] === "" ||
    typeof candidate["itemTitle"] !== "string" ||
    candidate["itemTitle"] === "" ||
    (itemType !== null && !PRESENTATION_ITEM_TYPES.includes(itemType as PresentationItemType)) ||
    !content
  ) {
    return null;
  }
  return {
    slideId: candidate["slideId"],
    itemId: candidate["itemId"],
    itemTitle: candidate["itemTitle"],
    itemType: itemType as PresentationItemType | null,
    content,
    label: typeof candidate["label"] === "string" ? candidate["label"] : undefined,
    secondaryText:
      typeof candidate["secondaryText"] === "string"
        ? candidate["secondaryText"]
        : undefined,
  };
}

function parseStageProjection(value: unknown): StageProjection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const current = candidate["current"] === null ? null : parseStageCue(candidate["current"]);
  const next = candidate["next"] === null ? null : parseStageCue(candidate["next"]);
  if (current === null && candidate["current"] !== null) return undefined;
  if (next === null && candidate["next"] !== null) return undefined;
  return { current, next };
}

/**
 * Contenido nuevo (`content`) o heredado (`lines`, versiones anteriores del
 * protocolo): una ventana Output vieja o nueva nunca queda sin validar.
 */
function parseContent(content: unknown, legacyLines: unknown): OutputSlideContent | null {
  if (typeof content === "object" && content !== null) {
    const candidate = content as Record<string, unknown>;
    if (candidate["kind"] === "text" && isStringArray(candidate["lines"])) {
      return { kind: "text", lines: candidate["lines"] };
    }
    if (
      (candidate["kind"] === "image" || candidate["kind"] === "video") &&
      typeof candidate["mediaId"] === "string" &&
      candidate["mediaId"] !== ""
    ) {
      return { kind: candidate["kind"], mediaId: candidate["mediaId"] };
    }
    return null;
  }
  if (isStringArray(legacyLines)) return { kind: "text", lines: legacyLines };
  return null;
}

function parseSnapshot(value: unknown): OutputSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate["sessionId"] !== "string" || candidate["sessionId"] === "") return null;
  if (typeof candidate["sequence"] !== "number" || !Number.isInteger(candidate["sequence"])) {
    return null;
  }
  const mode = candidate["mode"];
  if (mode !== "content" && mode !== "clear" && mode !== "black") return null;
  const backgroundTransition = candidate["backgroundTransition"] === "fade" ? "fade" : "cut";

  const slide = candidate["slide"];
  if (slide !== null) {
    if (typeof slide !== "object" || slide === null) return null;
    const s = slide as Record<string, unknown>;
    if (typeof s["id"] !== "string") return null;
    if (parseContent(s["content"], s["lines"]) === null) return null;
  }

  return {
    sessionId: candidate["sessionId"],
    sequence: candidate["sequence"],
    mode,
    backgroundTransition,
    stage: parseStageProjection(candidate["stage"]),
    slide:
      slide === null
        ? null
        : (() => {
            const rawSlide = slide as Record<string, unknown>;
            const style = normalizePresetStyle(rawSlide["style"]);
            return {
            id: (slide as { id: string }).id,
            content: parseContent(
              (slide as { content?: unknown }).content,
              (slide as { lines?: unknown }).lines,
            ) as OutputSlideContent,
            // Texto secundario opcional: cualquier otra forma se ignora.
            secondaryText:
              typeof (slide as { secondaryText?: unknown }).secondaryText === "string"
                ? ((slide as { secondaryText: string }).secondaryText)
                : undefined,
            // Un estilo ausente o inválido cae al Default campo a campo: la
            // salida nunca queda indefinida.
            style,
            background: parseBackground(rawSlide["background"], style.background.color),
            playback: isVideoPlayback((slide as { playback?: unknown }).playback)
              ? (slide as { playback: VideoPlaybackState }).playback
              : undefined,
            };
          })(),
  };
}

/**
 * Valida un mensaje recibido por el canal. Devuelve `null` ante cualquier
 * forma inesperada: los mensajes inválidos se ignoran en silencio.
 */
export function parseOutputMessage(value: unknown): OutputMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  switch (candidate["type"]) {
    case "hello":
      return { type: "hello" };
    case "snapshot":
    case "update": {
      const snapshot = parseSnapshot(candidate["snapshot"]);
      return snapshot ? { type: candidate["type"], snapshot } : null;
    }
    case "bye": {
      const sessionId = candidate["sessionId"];
      return typeof sessionId === "string" && sessionId !== ""
        ? { type: "bye", sessionId }
        : null;
    }
    default:
      return null;
  }
}
