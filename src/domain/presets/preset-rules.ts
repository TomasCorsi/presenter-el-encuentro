import {
  DEFAULT_PRESET_STYLE,
  LOCAL_WORKSPACE_ID,
  PRESET_NAME_MAX_LENGTH,
  isDefaultPresetId,
  type CreatePresetInput,
  type Preset,
  type PresetBackground,
  type PresetFactoryDependencies,
  type PresetFontFamily,
  type PresetFontWeight,
  type PresetHorizontalAlign,
  type PresetStyle,
  type PresetVerticalAlign,
} from "./preset";

export class PresetNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetNameError";
  }
}

export class DefaultPresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefaultPresetError";
  }
}

export function normalizePresetName(value: string): string {
  const name = value.trim();
  if (!name) throw new PresetNameError("El nombre del preset es obligatorio.");
  if (name.length > PRESET_NAME_MAX_LENGTH) {
    throw new PresetNameError(`El nombre no puede superar ${PRESET_NAME_MAX_LENGTH} caracteres.`);
  }
  return name;
}

const FONT_FAMILIES: readonly PresetFontFamily[] = ["sans", "serif", "mono"];
const FONT_WEIGHTS: readonly PresetFontWeight[] = [400, 600, 700];
const H_ALIGNS: readonly PresetHorizontalAlign[] = ["left", "center", "right"];
const V_ALIGNS: readonly PresetVerticalAlign[] = ["top", "center", "bottom"];

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const FONT_SIZE_RANGE = { min: 1, max: 30 } as const;
export const LINE_HEIGHT_RANGE = { min: 1, max: 2 } as const;
export const SAFE_AREA_RANGE = { min: 0, max: 20 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function colorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function backgroundOr(value: unknown, fallback: PresetBackground): PresetBackground {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  // Cualquier `type` desconocido (image, video…) cae al Default: nunca se
  // representa una salida indefinida.
  if (candidate["type"] !== "solid") return fallback;
  return { type: "solid", color: colorOr(candidate["color"], fallback.color) };
}

/**
 * Normalización defensiva: convierte cualquier valor (datos persistidos,
 * mensajes del canal de Output, entrada de la UI) en un `PresetStyle` válido,
 * cayendo campo a campo al Default. Nunca lanza.
 */
export function normalizePresetStyle(value: unknown): PresetStyle {
  const base = DEFAULT_PRESET_STYLE;
  if (!value || typeof value !== "object") return { ...base, background: { ...base.background } };
  const candidate = value as Record<string, unknown>;

  const fontFamily = FONT_FAMILIES.includes(candidate["fontFamily"] as PresetFontFamily)
    ? (candidate["fontFamily"] as PresetFontFamily)
    : base.fontFamily;
  const fontWeight = FONT_WEIGHTS.includes(candidate["fontWeight"] as PresetFontWeight)
    ? (candidate["fontWeight"] as PresetFontWeight)
    : base.fontWeight;
  const align = H_ALIGNS.includes(candidate["align"] as PresetHorizontalAlign)
    ? (candidate["align"] as PresetHorizontalAlign)
    : base.align;
  const verticalAlign = V_ALIGNS.includes(candidate["verticalAlign"] as PresetVerticalAlign)
    ? (candidate["verticalAlign"] as PresetVerticalAlign)
    : base.verticalAlign;

  return {
    fontFamily,
    fontSize: numberOr(candidate["fontSize"], base.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max),
    fontWeight,
    lineHeight: numberOr(candidate["lineHeight"], base.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max),
    align,
    verticalAlign,
    textColor: colorOr(candidate["textColor"], base.textColor),
    background: backgroundOr(candidate["background"], base.background),
    safeAreaX: numberOr(candidate["safeAreaX"], base.safeAreaX, SAFE_AREA_RANGE.min, SAFE_AREA_RANGE.max),
    safeAreaY: numberOr(candidate["safeAreaY"], base.safeAreaY, SAFE_AREA_RANGE.min, SAFE_AREA_RANGE.max),
  };
}

export function presetStylesEqual(a: PresetStyle, b: PresetStyle): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.lineHeight === b.lineHeight &&
    a.align === b.align &&
    a.verticalAlign === b.verticalAlign &&
    a.textColor === b.textColor &&
    a.safeAreaX === b.safeAreaX &&
    a.safeAreaY === b.safeAreaY &&
    a.background.type === b.background.type &&
    a.background.color === b.background.color
  );
}

export function cloneStyle(style: PresetStyle): PresetStyle {
  return { ...style, background: { ...style.background } };
}

export function createPreset(
  input: CreatePresetInput,
  dependencies: PresetFactoryDependencies,
): Preset {
  const timestamp = dependencies.now();
  return {
    id: dependencies.createId(),
    workspaceId: input.workspaceId ?? LOCAL_WORKSPACE_ID,
    name: normalizePresetName(input.name),
    style: normalizePresetStyle(input.style ?? DEFAULT_PRESET_STYLE),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function assertEditable(preset: Preset): void {
  if (isDefaultPresetId(preset.id)) {
    throw new DefaultPresetError("El preset por defecto no puede modificarse ni eliminarse.");
  }
}

export function renamePreset(preset: Preset, name: string, now: () => string): Preset {
  assertEditable(preset);
  return { ...preset, name: normalizePresetName(name), updatedAt: now() };
}

export function updatePresetStyle(preset: Preset, style: PresetStyle, now: () => string): Preset {
  assertEditable(preset);
  return { ...preset, style: normalizePresetStyle(style), updatedAt: now() };
}

export function duplicatePreset(preset: Preset, dependencies: PresetFactoryDependencies): Preset {
  const timestamp = dependencies.now();
  return {
    id: dependencies.createId(),
    workspaceId: preset.workspaceId,
    name: `${preset.name} — copia`.slice(0, PRESET_NAME_MAX_LENGTH),
    style: cloneStyle(preset.style),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function assertDeletable(preset: Preset): void {
  assertEditable(preset);
}

/** El Default siempre primero; el resto por nombre. */
export function sortPresets(presets: readonly Preset[]): Preset[] {
  return [...presets].sort((a, b) => {
    if (isDefaultPresetId(a.id)) return -1;
    if (isDefaultPresetId(b.id)) return 1;
    return a.name.localeCompare(b.name, "es");
  });
}

export function filterPresets(presets: readonly Preset[], query: string): Preset[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...presets];
  return presets.filter((preset) => preset.name.toLowerCase().includes(term));
}
