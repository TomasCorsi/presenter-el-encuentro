import { DEFAULT_PRESET_ID, type Preset } from "@/domain/presets/preset";
import { cloneStyle, normalizePresetStyle } from "@/domain/presets/preset-rules";

import type { PresetRepository } from "./preset-repository";

export const STORAGE_KEY = "broadcast-control.presets.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredPresets {
  version: 1;
  presets: Preset[];
}

const EMPTY_STATE: StoredPresets = { version: 1, presets: [] };

/**
 * Validación defensiva: un preset sin identidad utilizable se descarta; un
 * estilo inválido se normaliza campo a campo al Default en lugar de perder el
 * preset entero.
 */
function parsePreset(value: unknown): Preset | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate["id"] !== "string" ||
    candidate["id"] === "" ||
    // El id reservado nunca se persiste: si aparece, se ignora.
    candidate["id"] === DEFAULT_PRESET_ID ||
    typeof candidate["workspaceId"] !== "string" ||
    typeof candidate["name"] !== "string" ||
    typeof candidate["createdAt"] !== "string" ||
    typeof candidate["updatedAt"] !== "string"
  ) {
    return null;
  }

  return {
    id: candidate["id"],
    workspaceId: candidate["workspaceId"],
    name: candidate["name"],
    style: normalizePresetStyle(candidate["style"]),
    createdAt: candidate["createdAt"],
    updatedAt: candidate["updatedAt"],
  };
}

function parseState(raw: string | null): StoredPresets {
  if (!raw) return { ...EMPTY_STATE, presets: [] };

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...EMPTY_STATE, presets: [] };
    const candidate = value as Record<string, unknown>;
    if (candidate["version"] !== 1 || !Array.isArray(candidate["presets"])) {
      return { ...EMPTY_STATE, presets: [] };
    }
    return {
      version: 1,
      presets: candidate["presets"]
        .map(parsePreset)
        .filter((preset): preset is Preset => preset !== null),
    };
  } catch {
    return { ...EMPTY_STATE, presets: [] };
  }
}

function clonePreset(preset: Preset): Preset {
  return { ...preset, style: cloneStyle(preset.style) };
}

export function createLocalStoragePresetRepository(storage: KeyValueStorage): PresetRepository {
  const read = () => parseState(storage.getItem(STORAGE_KEY));
  const write = (state: StoredPresets) => storage.setItem(STORAGE_KEY, JSON.stringify(state));

  return {
    async list() {
      return read().presets.map(clonePreset);
    },
    async get(id) {
      const preset = read().presets.find((item) => item.id === id);
      return preset ? clonePreset(preset) : null;
    },
    async create(preset) {
      const state = read();
      if (state.presets.some((item) => item.id === preset.id)) {
        throw new Error("Ya existe un preset con ese identificador.");
      }
      write({ ...state, presets: [...state.presets, preset] });
      return clonePreset(preset);
    },
    async update(preset) {
      const state = read();
      if (!state.presets.some((item) => item.id === preset.id)) {
        throw new Error("El preset ya no existe.");
      }
      write({
        ...state,
        presets: state.presets.map((item) => (item.id === preset.id ? preset : item)),
      });
      return clonePreset(preset);
    },
    async delete(id) {
      const state = read();
      write({ ...state, presets: state.presets.filter((preset) => preset.id !== id) });
    },
  };
}
