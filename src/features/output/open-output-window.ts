import type { ScreenInfo } from "@/services/display/window-management";

/** Nombre fijo: reabrir reutiliza la misma ventana, nunca duplica la salida. */
export const OUTPUT_WINDOW_NAME = "audience-main";
export const OUTPUT_MAIN_PATH = "/output/main";
export const OUTPUT_TEST_PATH = "/output/main?mode=test";

export interface OutputWindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Ventana tal como la necesitamos: subconjunto verificable en tests. */
export interface OutputWindowLike {
  closed: boolean;
  moveTo?(x: number, y: number): void;
  resizeTo?(width: number, height: number): void;
  focus?(): void;
  close?(): void;
}

export type OpenWindowFn = (
  url: string,
  name: string,
  features: string,
) => OutputWindowLike | null;

export type OpenOutputResult =
  | { status: "opened"; window: OutputWindowLike }
  | { status: "blocked" };

export function rectFromScreen(info: ScreenInfo): OutputWindowRect {
  return {
    left: info.availLeft,
    top: info.availTop,
    width: info.availWidth,
    height: info.availHeight,
  };
}

function buildFeatures(rect: OutputWindowRect | null): string {
  if (!rect) return "popup=yes";
  return [
    "popup=yes",
    `left=${rect.left}`,
    `top=${rect.top}`,
    `width=${rect.width}`,
    `height=${rect.height}`,
  ].join(",");
}

/** El navegador puede restringir mover/redimensionar: nunca debe romper el flujo. */
function attempt(action: (() => void) | undefined): void {
  if (!action) return;
  try {
    action();
  } catch {
    // Restricción del navegador: la ventana ya está abierta, es suficiente.
  }
}

export interface OpenOutputWindowOptions {
  url?: string;
  name?: string;
  /** `null` abre sin geometría (modo alternativo, sin proyector configurado). */
  rect?: OutputWindowRect | null;
  open: OpenWindowFn;
}

/**
 * Abre —o reutiliza— la ventana de salida. `window.open` con nombre fijo
 * reutiliza la ventana existente pero NO garantiza reposicionarla, así que
 * después siempre se intenta mover, redimensionar y enfocar.
 */
export function openOutputWindow({
  url = OUTPUT_MAIN_PATH,
  name = OUTPUT_WINDOW_NAME,
  rect = null,
  open,
}: OpenOutputWindowOptions): OpenOutputResult {
  const target = open(url, name, buildFeatures(rect));
  if (!target || target.closed) return { status: "blocked" };

  if (rect) {
    attempt(target.moveTo ? () => target.moveTo?.(rect.left, rect.top) : undefined);
    attempt(target.resizeTo ? () => target.resizeTo?.(rect.width, rect.height) : undefined);
  }
  attempt(target.focus ? () => target.focus?.() : undefined);

  return { status: "opened", window: target };
}

/** Adaptador real del navegador; los tests inyectan su propio `OpenWindowFn`. */
export const browserOpenWindow: OpenWindowFn = (url, name, features) =>
  window.open(url, name, features) as OutputWindowLike | null;
