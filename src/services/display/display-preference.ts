import type { ScreenFingerprint } from "./window-management";

/**
 * Preferencia LOCAL del puesto de trabajo: qué pantalla física se usa como
 * proyector. No pertenece al Project ni se sincroniza con nada.
 */
export const AUDIENCE_SCREEN_KEY = "broadcast-control.display.audience";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredPreference {
  version: 1;
  fingerprint: ScreenFingerprint;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Lectura defensiva: cualquier dato corrupto equivale a «no configurado». */
export function parseAudienceScreen(raw: string | null): ScreenFingerprint | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const stored = value as Record<string, unknown>;
    if (stored["version"] !== 1) return null;
    const candidate = stored["fingerprint"];
    if (!candidate || typeof candidate !== "object") return null;
    const info = candidate as Record<string, unknown>;

    if (typeof info["label"] !== "string") return null;
    for (const key of [
      "width",
      "height",
      "availWidth",
      "availHeight",
      "availLeft",
      "availTop",
      "devicePixelRatio",
    ]) {
      if (!isFiniteNumber(info[key])) return null;
    }
    if (typeof info["isPrimary"] !== "boolean") return null;

    return {
      label: info["label"],
      width: info["width"] as number,
      height: info["height"] as number,
      availWidth: info["availWidth"] as number,
      availHeight: info["availHeight"] as number,
      availLeft: info["availLeft"] as number,
      availTop: info["availTop"] as number,
      devicePixelRatio: info["devicePixelRatio"] as number,
      isPrimary: info["isPrimary"],
    };
  } catch {
    return null;
  }
}

export function readAudienceScreen(storage: KeyValueStorage): ScreenFingerprint | null {
  return parseAudienceScreen(storage.getItem(AUDIENCE_SCREEN_KEY));
}

export function writeAudienceScreen(
  storage: KeyValueStorage,
  fingerprint: ScreenFingerprint,
): void {
  const payload: StoredPreference = { version: 1, fingerprint };
  storage.setItem(AUDIENCE_SCREEN_KEY, JSON.stringify(payload));
}

export function clearAudienceScreen(storage: KeyValueStorage): void {
  storage.removeItem(AUDIENCE_SCREEN_KEY);
}
