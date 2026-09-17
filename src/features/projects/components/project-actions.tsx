import { Copy, MoreVertical, Pencil, Radio, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Project } from "@/domain/projects/project";
import { Button } from "@/components/ui/button";
import { ProjectDialog } from "./project-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProjectActionsProps {
  project: Project;
  isActive: boolean;
  onActivate(): Promise<void>;
  onRename(name: string): Promise<void>;
  onDuplicate(): Promise<void>;
  onDelete(): Promise<void>;
}

export function ProjectActions(props: ProjectActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const runMenuAction = (action: () => Promise<void>) => {
    void action().catch(() => undefined);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${props.project.name}`}>
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {!props.isActive ? (
            <DropdownMenuItem onSelect={() => runMenuAction(props.onActivate)}><Radio />Marcar como activo</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}><Pencil />Renombrar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runMenuAction(props.onDuplicate)}><Copy />Duplicar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog
        mode="rename"
        open={renameOpen}
        initialName={props.project.name}
        onOpenChange={setRenameOpen}
        onSubmit={props.onRename}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              “{props.project.name}” se eliminará de este dispositivo. Esta acción no se puede deshacer.
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