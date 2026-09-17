import { useEffect, useState, type FormEvent } from "react";

import { PROJECT_NAME_MAX_LENGTH } from "@/domain/projects/project";
import { normalizeProjectName } from "@/domain/projects/project-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProjectDialogProps {
  mode: "create" | "rename";
  open: boolean;
  initialName?: string;
  onOpenChange(open: boolean): void;
  onSubmit(name: string): Promise<void>;
}

export function ProjectDialog({ mode, open, initialName = "", onOpenChange, onSubmit }: ProjectDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [initialName, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const normalizedName = normalizeProjectName(name);
      setSaving(true);
      await onSubmit(normalizedName);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  const creating = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md border-border bg-popover">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{creating ? "Crear proyecto" : "Renombrar proyecto"}</DialogTitle>
            <DialogDescription>
              {creating ? "Crea el contexto para una nueva producción." : "Actualiza el nombre del proyecto."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Label htmlFor={`${mode}-project-name`}>Nombre del proyecto</Label>
            <Input
              id={`${mode}-project-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={PROJECT_NAME_MAX_LENGTH}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${mode}-project-error` : undefined}
              className="mt-2"
            />
            {error ? <p id={`${mode}-project-error`} className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : creating ? "Crear" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}