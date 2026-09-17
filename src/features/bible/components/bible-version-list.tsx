import { Link } from "@tanstack/react-router";
import { BookOpen, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BibleVersionMeta } from "@/domain/bible/bible";

export interface BibleVersionListProps {
  versions: readonly BibleVersionMeta[];
  onDelete(versionId: string): Promise<void>;
}

export function BibleVersionList({ versions, onDelete }: BibleVersionListProps) {
  const [pending, setPending] = useState<BibleVersionMeta | null>(null);

  return (
    <>
      <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
        {versions.map((version) => (
          <li key={version.id} className="flex items-center gap-3 bg-card px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground" aria-hidden="true">
              <BookOpen className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{version.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {version.abbreviation} · {version.language} · {version.bookCount} libros
                {version.publisher ? ` · ${version.publisher}` : ""}
              </p>
            </div>

            <StatusBadge tone="online">Instalada</StatusBadge>

            <div className="flex shrink-0 items-center gap-1">
              <Button asChild variant="outline" size="sm">
                <Link to="/bible/$versionId" params={{ versionId: version.id }}>Abrir</Link>
              </Button>
              <Button
                variant="ghost" size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Eliminar ${version.title}`}
                onClick={() => setPending(version)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar traducción</AlertDialogTitle>
            <AlertDialogDescription>
              “{pending?.title}” se borra de este dispositivo y dejará de estar disponible para
              buscar pasajes nuevos. Los pasajes que ya agregaste a un proyecto siguen funcionando:
              guardan su propio texto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const versionId = pending?.id;
                if (versionId) void onDelete(versionId).catch(() => undefined);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
