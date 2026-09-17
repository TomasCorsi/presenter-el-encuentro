import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type {
  PresetFontFamily,
  PresetFontWeight,
  PresetHorizontalAlign,
  PresetStyle,
  PresetVerticalAlign,
} from "@/domain/presets/preset";
import { FONT_SIZE_RANGE, LINE_HEIGHT_RANGE, SAFE_AREA_RANGE } from "@/domain/presets/preset-rules";

export interface PresetStyleFormProps {
  style: PresetStyle;
  disabled?: boolean | undefined;
  onChange(style: PresetStyle): void;
  onCommit?: (() => void) | undefined;
}

/**
 * Formulario de apariencia. Los colores que elige el usuario son DATOS del
 * preset; los controles en sí siguen usando tokens semánticos de la UI.
 */
export function PresetStyleForm({ style, disabled, onChange, onCommit }: PresetStyleFormProps) {
  const patch = (next: Partial<PresetStyle>) => onChange({ ...style, ...next });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="preset-font">Tipografía</Label>
          <Select
            disabled={disabled ?? false}
            value={style.fontFamily}
            onValueChange={(value) => patch({ fontFamily: value as PresetFontFamily })}
          >
            <SelectTrigger id="preset-font" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sans">System Sans</SelectItem>
              <SelectItem value="serif">System Serif</SelectItem>
              <SelectItem value="mono">System Mono</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="preset-weight">Peso</Label>
          <Select
            disabled={disabled ?? false}
            value={String(style.fontWeight)}
            onValueChange={(value) => patch({ fontWeight: Number(value) as PresetFontWeight })}
          >
            <SelectTrigger id="preset-weight" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">Regular</SelectItem>
              <SelectItem value="600">Semibold</SelectItem>
              <SelectItem value="700">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="preset-align">Alineación horizontal</Label>
          <Select
            disabled={disabled ?? false}
            value={style.align}
            onValueChange={(value) => patch({ align: value as PresetHorizontalAlign })}
          >
            <SelectTrigger id="preset-align" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Izquierda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Derecha</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="preset-valign">Alineación vertical</Label>
          <Select
            disabled={disabled ?? false}
            value={style.verticalAlign}
            onValueChange={(value) => patch({ verticalAlign: value as PresetVerticalAlign })}
          >
            <SelectTrigger id="preset-valign" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Arriba</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="bottom">Abajo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="preset-size">Tamaño de texto</Label>
          <span className="font-mono text-xs text-muted-foreground">{style.fontSize}% de altura</span>
        </div>
        <Slider
          id="preset-size"
          disabled={disabled ?? false}
          className="mt-2.5"
          min={FONT_SIZE_RANGE.min}
          max={FONT_SIZE_RANGE.max}
          step={0.5}
          value={[style.fontSize]}
          onValueChange={([value]) => patch({ fontSize: value ?? style.fontSize })}
          onValueCommit={() => onCommit?.()}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="preset-line-height">Interlineado</Label>
          <span className="font-mono text-xs text-muted-foreground">{style.lineHeight.toFixed(2)}</span>
        </div>
        <Slider
          id="preset-line-height"
          disabled={disabled ?? false}
          className="mt-2.5"
          min={LINE_HEIGHT_RANGE.min}
          max={LINE_HEIGHT_RANGE.max}
          step={0.05}
          value={[style.lineHeight]}
          onValueChange={([value]) => patch({ lineHeight: value ?? style.lineHeight })}
          onValueCommit={() => onCommit?.()}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="preset-safe-x">Safe area horizontal</Label>
            <span className="font-mono text-xs text-muted-foreground">{style.safeAreaX}%</span>
          </div>
          <Slider
            id="preset-safe-x"
            disabled={disabled ?? false}
            className="mt-2.5"
            min={SAFE_AREA_RANGE.min}
            max={SAFE_AREA_RANGE.max}
            step={1}
            value={[style.safeAreaX]}
            onValueChange={([value]) => patch({ safeAreaX: value ?? style.safeAreaX })}
            onValueCommit={() => onCommit?.()}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="preset-safe-y">Safe area vertical</Label>
            <span className="font-mono text-xs text-muted-foreground">{style.safeAreaY}%</span>
          </div>
          <Slider
            id="preset-safe-y"
            disabled={disabled ?? false}
            className="mt-2.5"
            min={SAFE_AREA_RANGE.min}
            max={SAFE_AREA_RANGE.max}
            step={1}
            value={[style.safeAreaY]}
            onValueChange={([value]) => patch({ safeAreaY: value ?? style.safeAreaY })}
            onValueCommit={() => onCommit?.()}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="preset-text-color">Color del texto</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="preset-text-color"
              type="color"
              disabled={disabled ?? false}
              value={style.textColor}
              onChange={(event) => patch({ textColor: event.target.value.toUpperCase() })}
              onBlur={onCommit}
              className="h-9 w-12 cursor-pointer rounded-sm border border-border bg-card"
            />
            <span className="font-mono text-xs text-muted-foreground">{style.textColor}</span>
          </div>
        </div>
        <div>
          <Label htmlFor="preset-bg-color">Fondo sólido</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="preset-bg-color"
              type="color"
              disabled={disabled ?? false}
              value={style.background.color}
              onChange={(event) =>
                patch({ background: { type: "solid", color: event.target.value.toUpperCase() } })
              }
              onBlur={onCommit}
              className="h-9 w-12 cursor-pointer rounded-sm border border-border bg-card"
            />
            <span className="font-mono text-xs text-muted-foreground">{style.background.color}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
