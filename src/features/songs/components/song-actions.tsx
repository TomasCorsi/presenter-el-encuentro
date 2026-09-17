import { Copy, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Song } from "@/domain/songs/song";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Datos planos de uso, calculados en la capa de composición (route).
 * Songs no importa nada de Projects.
 */
export interface SongUsageInfo {
  occurrences: number;
  projectNames: string[];
}

export interface SongActionsProps {
  song: Song;
  usage?: SongUsageInfo | undefined;
  onDuplicate(): Promise<void>;
  onDelete(): Promise<void>;
}

function usageMessage(usage: SongUsageInfo): string {
  const names = usage.projectNames.slice(0, 3).join(", ");
  const rest = usage.projectNames.length - 3;
  const projects = rest > 0 ? `${names} y ${rest} más` : names;
  const times = usage.occurrences === 1 ? "1 vez" : `${usage.occurrences} veces`;
  return `Está en uso ${times} en: ${projects}. Esas apariciones quedarán como contenido faltante.`;
}

export function SongActions(props: SongActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const runMenuAction = (action: () => Promise<void>) => {
    void action().catch(() => undefined);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${props.song.title}`}>
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => runMenuAction(props.onDuplicate)}><Copy />Duplicar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar canción</AlertDialogTitle>
            <AlertDialogDescription>
              “{props.song.title}” se eliminará de este dispositivo. Esta acción no se puede deshacer.
              {props.usage && props.usage.occurrences > 0 ? ` ${usageMessage(props.usage)}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => runMenuAction(props.onDelete)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
