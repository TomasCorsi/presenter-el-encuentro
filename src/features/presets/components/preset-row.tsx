import { Link } from "@tanstack/react-router";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { isDefaultPresetId, type Preset } from "@/domain/presets/preset";
import type { PresetUsage } from "@/domain/presets/preset-resolution";
import { resolveSlideRenderStyle } from "@/domain/presets/resolve-slide-render-style";

export interface PresetRowProps {
  preset: Preset;
  usage: PresetUsage;
  onRename(): void;
  onDuplicate(): Promise<unknown>;
  onDelete(): Promise<unknown>;
}

function usageLabel(usage: PresetUsage): string {
  if (usage.occurrences === 0) return "Sin uso en rundowns";
  const items = `${usage.occurrences} ${usage.occurrences === 1 ? "elemento" : "elementos"}`;
  return `${items} · ${usage.projectNames.join(", ")}`;
}

export function PresetRow({ preset, usage, onRename, onDuplicate, onDelete }: PresetRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isDefault = isDefaultPresetId(preset.id);
  const resolved = resolveSlideRenderStyle(preset.style);
  const run = (action: () => Promise<unknown>) => {
    void action().catch(() => undefined);
  };

  return (
    <li className="flex items-center gap-3 bg-card px-3 py-2.5">
      <span
        aria-hidden="true"
        className="grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-sm border border-border"
        style={{ background: resolved.background, color: resolved.color }}
      >
        <span className="text-[10px] font-semibold">Aa</span>
      </span>

      <div className="min-w-0 flex-1">
        <Link
          to="/presets/$presetId"
          params={{ presetId: preset.id }}
          className="truncate text-sm font-medium text-foreground hover:underline"
        >
          {preset.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{usageLabel(usage)}</p>
      </div>

      {isDefault ? <StatusBadge tone="neutral">Por defecto</StatusBadge> : null}

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isDefault}
          aria-label={`Renombrar ${preset.name}`}
          onClick={onRename}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Duplicar ${preset.name}`}
          onClick={() => run(onDuplicate)}
        >
          <Copy aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          disabled={isDefault}
          aria-label={`Eliminar ${preset.name}`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar preset</AlertDialogTitle>
            <AlertDialogDescription>
              {usage.occurrences > 0
                ? `“${preset.name}” está en uso por ${usageLabel(usage)}. Esos elementos pasarán a usar el preset por defecto.`
                : `“${preset.name}” se eliminará de este dispositivo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(onDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
