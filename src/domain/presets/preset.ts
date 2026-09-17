import { LOCAL_WORKSPACE_ID } from "@/domain/projects/project";

export { LOCAL_WORKSPACE_ID };

/**
 * Modelo de Preset: apariencia reutilizable, separada del contenido.
 *
 * Dominio puro: sin React, sin DOM, sin acceso a persistencia. El Preset NUNCA
 * guarda texto y la Song NUNCA guarda estilos (ADR-032).
 */

export const PRESET_NAME_MAX_LENGTH = 80;

/** Solo stacks locales del sistema: sin Google Fonts ni CDN (offline-first). */
export type PresetFontFamily = "sans" | "serif" | "mono";
export type PresetFontWeight = 400 | 600 | 700;
export type PresetHorizontalAlign = "left" | "center" | "right";
export type PresetVerticalAlign = "top" | "center" | "bottom";

/**
 * Unión discriminada desde el inicio: en la Fase 8 el único caso válido es
 * `solid`; `image` o `video` se añadirán con Media ampliando la unión, sin
 * migrar el modelo (ADR-039).
 */
export interface PresetSolidBackground {
  type: "solid";
  color: string;
}

export type PresetBackground = PresetSolidBackground;

export interface PresetStyle {
  fontFamily: PresetFontFamily;
  /** % de la ALTURA del lienzo (1..30); el renderer lo convierte a `cqh`. */
  fontSize: number;
  fontWeight: PresetFontWeight;
  /** Multiplicador 1.0..2.0. */
  lineHeight: number;
  align: PresetHorizontalAlign;
  verticalAlign: PresetVerticalAlign;
  /** Color de texto en hex; es DATO del usuario, no un token de UI. */
  textColor: string;
  background: PresetBackground;
  /** Safe area horizontal, % del ancho (0..20). */
  safeAreaX: number;
  /** Safe area vertical, % de la altura (0..20). */
  safeAreaY: number;
}

export interface Preset {
  id: string;
  workspaceId: string;
  name: string;
  style: PresetStyle;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePresetInput {
  name: string;
  style?: PresetStyle | undefined;
  workspaceId?: string | undefined;
}

export interface PresetFactoryDependencies {
  createId: () => string;
  now: () => string;
}

/** Id reservado del Preset por defecto: no se persiste ni se edita (ADR-033). */
export const DEFAULT_PRESET_ID = "preset-default";

/** Fecha fija: el Default nunca cambia, así que su firma es estable. */
const DEFAULT_PRESET_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export const DEFAULT_PRESET_STYLE: PresetStyle = {
  fontFamily: "sans",
  fontSize: 8,
  fontWeight: 600,
  lineHeight: 1.2,
  align: "center",
  verticalAlign: "center",
  textColor: "#FFFFFF",
  background: { type: "solid", color: "#0B0D10" },
  safeAreaX: 8,
  safeAreaY: 8,
};

export const DEFAULT_PRESET: Preset = {
  id: DEFAULT_PRESET_ID,
  workspaceId: LOCAL_WORKSPACE_ID,
  name: "Default",
  style: DEFAULT_PRESET_STYLE,
  createdAt: DEFAULT_PRESET_TIMESTAMP,
  updatedAt: DEFAULT_PRESET_TIMESTAMP,
};

export function isDefaultPresetId(id: string | undefined): boolean {
  return id === DEFAULT_PRESET_ID;
}
