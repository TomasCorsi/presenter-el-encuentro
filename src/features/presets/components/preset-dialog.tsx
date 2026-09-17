import { useEffect, useState } from "react";

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
import { PRESET_NAME_MAX_LENGTH } from "@/domain/presets/preset";

export interface PresetDialogProps {
  open: boolean;
  mode: "create" | "rename";
  initialName?: string | undefined;
  onOpenChange(open: boolean): void;
  onSubmit(name: string): Promise<unknown>;
}

/** Diálogo compacto para crear o renombrar un preset. */
export function PresetDialog({ open, mode, initialName, onOpenChange, onSubmit }: PresetDialogProps) {
  const [name, setName] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [initialName, open]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch {
      // El error se muestra en la pantalla mediante el estado del provider.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md border-border bg-popover">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo preset" : "Renombrar preset"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Parte del estilo por defecto y ajústalo en el editor."
              : "Cambia el nombre con el que aparece en la biblioteca y en el rundown."}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="preset-name">Nombre</Label>
          <Input
            id="preset-name"
            value={name}
            autoFocus
            maxLength={PRESET_NAME_MAX_LENGTH}
            placeholder="Lyrics Center"
            className="mt-1.5"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name.trim() || busy} onClick={() => void submit()}>
            {mode === "create" ? "Crear preset" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
