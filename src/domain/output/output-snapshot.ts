import type { ProgramMode } from "@/domain/presentation/presentation";
import type { ProgramOutput } from "@/domain/presentation/presentation-selectors";

/**
 * Protocolo Output Sync (ADR-028).
 *
 * Dominio puro: sin DOM, sin BroadcastChannel, sin React. Define el contrato
 * de mensajes entre Live (autoridad) y los Outputs (consumidores), y la
 * validación defensiva de todo lo que llega por el canal.
 */

/** Contenido resuelto de una slide: Output nunca reconstruye nada. */
export interface OutputSlide {
  id: string;
  lines: string[];
}

/** Estado completo que Output necesita para pintar Program. */
export interface OutputSnapshot {
  sessionId: string;
  sequence: number;
  mode: ProgramMode;
  /** `null` en `clear`, `black` o Program vacío. */
  slide: OutputSlide | null;
}

export type OutputMessage =
  | { type: "hello" }
  | { type: "snapshot"; snapshot: OutputSnapshot }
  | { type: "update"; snapshot: OutputSnapshot }
  | { type: "bye"; sessionId: string };

export const OUTPUT_CHANNEL_NAME = "broadcast-control.output.v1";

export const HEARTBEAT_INTERVAL_MS = 2000;
export const LIVENESS_TIMEOUT_MS = 5000;

/** Deriva el snapshot a publicar a partir de la salida de Program. */
export function toOutputSnapshot(
  output: ProgramOutput,
  sessionId: string,
  sequence: number,
): OutputSnapshot {
  return {
    sessionId,
    sequence,
    mode: output.mode,
    slide: output.slide ? { id: output.slide.id, lines: [...output.slide.content.lines] } : null,
  };
}

function linesEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

/**
 * Compara todo lo que Output pinta. Mismo `slide.id` con `lines` distintas
 * cuenta como cambio (editar la Song y recargar produce un `update`).
 */
export function snapshotsEqual(a: OutputSnapshot, b: OutputSnapshot): boolean {
  if (a.mode !== b.mode) return false;
  if (a.slide === null || b.slide === null) return a.slide === b.slide;
  return a.slide.id === b.slide.id && linesEqual(a.slide.lines, b.slide.lines);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

  const slide = candidate["slide"];
  if (slide !== null) {
    if (typeof slide !== "object" || slide === null) return null;
    const s = slide as Record<string, unknown>;
    if (typeof s["id"] !== "string" || !isStringArray(s["lines"])) return null;
  }

  return {
    sessionId: candidate["sessionId"],
    sequence: candidate["sequence"],
    mode,
    slide:
      slide === null
        ? null
        : { id: (slide as { id: string }).id, lines: (slide as { lines: string[] }).lines },
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
