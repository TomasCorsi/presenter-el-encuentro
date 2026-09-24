import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  Music,
  Trash2,
} from "lucide-react";
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
import type { Preset } from "@/domain/presets/preset";
import type { RundownItem } from "@/domain/projects/rundown";
import type { MediaAsset, MediaKind } from "@/domain/media/media";
import type { RundownBackground } from "@/domain/projects/rundown";
import { PresetPicker } from "@/features/presets/components/preset-picker";
import { BackgroundPicker } from "./background-picker";

export interface RundownRowProps {
  item: RundownItem;
  position: number;
  /** Título vivo de la fuente; ausente cuando la referencia está rota. */
  sourceTitle?: string | undefined;
  sourceAuthor?: string | undefined;
  mediaKind?: MediaKind | undefined;
  thumbnailDataUrl?: string | undefined;
  isFirst: boolean;
  isLast: boolean;
  onMove(direction: "up" | "down"): Promise<void>;
  onRemove(): Promise<void>;
  /** Biblioteca de presets disponible para esta aparición. */
  presets: readonly Preset[];
  onSetPreset(presetId: string | undefined): Promise<void>;
  mediaAssets?: readonly MediaAsset[];
  onSetBackground?: (background: RundownBackground | undefined) => Promise<void>;
  /** Media al aire: quitar bloqueado (Fase 10). */
  removeBlockReason?: string | null;
}

export function RundownRow({
  item,
  position,
  sourceTitle,
  sourceAuthor,
  mediaKind,
  thumbnailDataUrl,
  isFirst,
  isLast,
  onMove,
  onRemove,
  presets,
  onSetPreset,
  mediaAssets = [],
  onSetBackground,
  removeBlockReason = null,
}: RundownRowProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const missing = sourceTitle === undefined;
  const title = sourceTitle ?? item.title;
  const isBible = item.type === "bible";
  const isMedia = item.type === "media";
  const TypeIcon = isBible ? BookOpen : mediaKind === "image" ? ImageIcon : isMedia ? Film : Music;
  const missingLabel = isBible
    ? "Contenido faltante — el pasaje guardado está incompleto"
    : isMedia
      ? "Contenido faltante — el archivo ya no está en la biblioteca"
      : "Contenido faltante — la canción ya no está en la biblioteca";
  const libraryLabel = isBible ? "Bible" : isMedia ? "Media" : "Songs";
  const run = (action: () => Promise<void>) => {
    void action().catch(() => undefined);
  };

  return (
    <li className="flex items-center gap-3 bg-card px-3 py-2.5">
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {position}
      </span>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-sm border border-border ${missing ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        aria-hidden="true"
      >
        {missing ? (
          <AlertTriangle className="size-4" />
        ) : thumbnailDataUrl ? (
          <img src={thumbnailDataUrl} alt="" className="h-full w-full rounded-sm object-cover" />
        ) : (
          <TypeIcon className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {missing ? missingLabel : (sourceAuthor ?? (isBible ? "Pasaje bíblico" : "Canción"))}
        </p>
      </div>

      {!isMedia ? (
        <div className="flex shrink-0 items-center gap-1">
          <PresetPicker
            presets={presets}
            value={item.presetId}
            label={`Preset de ${title}`}
            onChange={(presetId) => run(() => onSetPreset(presetId))}
          />
          <BackgroundPicker
            assets={mediaAssets}
            value={item.background}
            label={`Fondo de ${title}`}
            onChange={(background) => run(() => onSetBackground?.(background) ?? Promise.resolve())}
          />
        </div>
      ) : null}

      <StatusBadge tone={missing ? "sync" : "neutral"} showDot={missing}>
        {missing ? "Faltante" : isBible ? "Bible" : isMedia ? mediaKind : "Song"}
      </StatusBadge>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isFirst}
          aria-label={`Subir ${title}`}
          onClick={() => run(() => onMove("up"))}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isLast}
          aria-label={`Bajar ${title}`}
          onClick={() => run(() => onMove("down"))}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          disabled={removeBlockReason !== null}
          title={removeBlockReason ?? undefined}
          aria-label={
            removeBlockReason
              ? `Quitar ${title} del rundown: ${removeBlockReason}`
              : `Quitar ${title} del rundown`
          }
          onClick={() => setRemoveOpen(true)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar del rundown</AlertDialogTitle>
            <AlertDialogDescription>
              “{title}” se quita de este rundown. El contenido permanece en la biblioteca de{" "}
              {libraryLabel}
              {isBible ? " o en el pasaje guardado" : ""} y otras apariciones no se ven afectadas.
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
