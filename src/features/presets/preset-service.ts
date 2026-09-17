import {
  DEFAULT_PRESET,
  isDefaultPresetId,
  type CreatePresetInput,
  type Preset,
  type PresetFactoryDependencies,
  type PresetStyle,
} from "@/domain/presets/preset";
import {
  DefaultPresetError,
  assertDeletable,
  createPreset,
  duplicatePreset,
  normalizePresetName,
  normalizePresetStyle,
  renamePreset,
  sortPresets,
  updatePresetStyle,
} from "@/domain/presets/preset-rules";
import type { PresetRepository } from "@/services/presets/preset-repository";

/**
 * Servicio de Presets. El Default se antepone SIEMPRE y nunca se persiste: la
 * biblioteca no puede quedarse sin un estilo válido (ADR-033).
 */
export class PresetService {
  constructor(
    private readonly repository: PresetRepository,
    private readonly dependencies: PresetFactoryDependencies,
  ) {}

  async load(): Promise<Preset[]> {
    return sortPresets([DEFAULT_PRESET, ...(await this.repository.list())]);
  }

  async create(input: CreatePresetInput): Promise<Preset> {
    return this.repository.create(createPreset(input, this.dependencies));
  }

  async rename(id: string, name: string): Promise<Preset> {
    const preset = await this.requirePreset(id);
    return this.repository.update(renamePreset(preset, name, this.dependencies.now));
  }

  async updateStyle(id: string, style: PresetStyle): Promise<Preset> {
    const preset = await this.requirePreset(id);
    return this.repository.update(updatePresetStyle(preset, style, this.dependencies.now));
  }

  /** Guarda un borrador completo del editor (nombre + estilo). */
  async save(draft: Preset): Promise<Preset> {
    const existing = await this.requirePreset(draft.id);
    return this.repository.update({
      ...existing,
      name: normalizePresetName(draft.name),
      style: normalizePresetStyle(draft.style),
      updatedAt: this.dependencies.now(),
    });
  }

  async duplicate(id: string): Promise<Preset> {
    const preset = isDefaultPresetId(id) ? DEFAULT_PRESET : await this.requirePreset(id);
    return this.repository.create(duplicatePreset(preset, this.dependencies));
  }

  async delete(id: string): Promise<void> {
    const preset = await this.requirePreset(id);
    assertDeletable(preset);
    await this.repository.delete(id);
  }

  private async requirePreset(id: string): Promise<Preset> {
    if (isDefaultPresetId(id)) {
      throw new DefaultPresetError("El preset por defecto no puede modificarse ni eliminarse.");
    }
    const preset = await this.repository.get(id);
    if (!preset) throw new Error("El preset ya no existe.");
    return preset;
  }
}
