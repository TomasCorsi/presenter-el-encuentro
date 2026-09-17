import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Music, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Preset } from "@/domain/presets/preset";
import type { RundownItem } from "@/domain/projects/rundown";
import { PresetPicker } from "@/features/presets/components/preset-picker";

export interface RundownRowProps {
  item: RundownItem;
  position: number;
  /** Título vivo de la fuente; ausente cuando la referencia está rota. */
  sourceTitle?: string | undefined;
  sourceAuthor?: string | undefined;
  isFirst: boolean;
  isLast: boolean;
  onMove(direction: "up" | "down"): Promise<void>;
  onRemove(): Promise<void>;
  /** Biblioteca de presets disponible para esta aparición. */
  presets: readonly Preset[];
  onSetPreset(presetId: string | undefined): Promise<void>;
}

export function RundownRow({ item, position, sourceTitle, sourceAuthor, isFirst, isLast, onMove, onRemove, presets, onSetPreset }: RundownRowProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const missing = sourceTitle === undefined;
  const title = sourceTitle ?? item.title;
  const isBible = item.type === "bible";
  const TypeIcon = isBible ? BookOpen : Music;
  const missingLabel = isBible
    ? "Contenido faltante — el pasaje guardado está incompleto"
    : "Contenido faltante — la canción ya no está en la biblioteca";
  const run = (action: () => Promise<void>) => { void action().catch(() => undefined); };

  return (
    <li className="flex items-center gap-3 bg-card px-3 py-2.5">
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{position}</span>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-sm border border-border ${missing ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        aria-hidden="true"
      >
        {missing ? <AlertTriangle className="size-4" /> : <TypeIcon className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {missing ? missingLabel : (sourceAuthor ?? (isBible ? "Pasaje bíblico" : "Canción"))}
        </p>
      </div>

      <PresetPicker
        presets={presets}
        value={item.presetId}
        label={`Preset de ${title}`}
        onChange={(presetId) => run(() => onSetPreset(presetId))}
      />

      <StatusBadge tone={missing ? "sync" : "neutral"} showDot={missing}>
        {missing ? "Faltante" : isBible ? "Bible" : "Song"}
      </StatusBadge>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8" disabled={isFirst}
          aria-label={`Subir ${title}`} onClick={() => run(() => onMove("up"))}>
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" disabled={isLast}
          aria-label={`Bajar ${title}`} onClick={() => run(() => onMove("down"))}>
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Quitar ${title} del rundown`} onClick={() => setRemoveOpen(true)}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar del rundown</AlertDialogTitle>
            <AlertDialogDescription>
              “{title}” se quita de este rundown. La canción permanece en la biblioteca y otras
              apariciones de la misma canción no se ven afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(onRemove)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
