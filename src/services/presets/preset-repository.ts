import type { Preset } from "@/domain/presets/preset";

/**
 * Contrato de persistencia de Presets. El Default NO se persiste: lo aporta el
 * servicio (ADR-033), así que este repositorio solo ve presets del usuario.
 */
export interface PresetRepository {
  list(): Promise<Preset[]>;
  get(id: string): Promise<Preset | null>;
  create(preset: Preset): Promise<Preset>;
  update(preset: Preset): Promise<Preset>;
  delete(id: string): Promise<void>;
}
