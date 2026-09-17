import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PRESET_ID, type Preset } from "@/domain/presets/preset";

export interface PresetPickerProps {
  presets: readonly Preset[];
  /** `undefined` = sin asignar, se resuelve al Default. */
  value: string | undefined;
  label: string;
  onChange(presetId: string | undefined): void;
}

/**
 * Selector compacto de Preset para una aparición del rundown. Un id que ya no
 * existe se muestra como Default, igual que lo resuelve el snapshot.
 */
export function PresetPicker({ presets, value, label, onChange }: PresetPickerProps) {
  const known = value && presets.some((preset) => preset.id === value) ? value : DEFAULT_PRESET_ID;

  return (
    <Select
      value={known}
      onValueChange={(next) => onChange(next === DEFAULT_PRESET_ID ? undefined : next)}
    >
      <SelectTrigger className="h-8 w-[150px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {presets.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
