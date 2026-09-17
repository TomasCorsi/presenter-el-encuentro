import { FileJson, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CanonicalBible } from "@/domain/bible/bible";

export interface BibleImportDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Convierte el texto del archivo al modelo canónico; lanza si no es válido. */
  onParse(text: string): CanonicalBible;
  onConfirm(bible: CanonicalBible): Promise<void>;
}

type Stage =
  | { step: "pick" }
  | { step: "reading" }
  | { step: "preview"; bible: CanonicalBible }
  | { step: "saving"; bible: CanonicalBible };

/**
 * Importación 100 % local: el archivo se lee en el dispositivo, se valida, se
 * muestra su metadata y solo entonces se guarda. Nada se envía a ningún
 * servidor.
 */
export function BibleImportDialog({ open, onOpenChange, onParse, onConfirm }: BibleImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ step: "pick" });
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage({ step: "pick" });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setStage({ step: "reading" });
    try {
      const text = await file.text();
      setStage({ step: "preview", bible: onParse(text) });
    } catch (cause) {
      setStage({ step: "pick" });
      setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo.");
    }
  }

  async function handleConfirm(bible: CanonicalBible) {
    setStage({ step: "saving", bible });
    try {
      await onConfirm(bible);
      reset();
      onOpenChange(false);
    } catch (cause) {
      setStage({ step: "preview", bible });
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la Biblia.");
    }
  }

  const bible = stage.step === "preview" || stage.step === "saving" ? stage.bible : null;
  const busy = stage.step === "reading" || stage.step === "saving";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-md border-border bg-popover">
        <DialogHeader>
          <DialogTitle>Importar Biblia</DialogTitle>
          <DialogDescription>
            Selecciona un archivo .json de tu dispositivo. La Biblia se guarda aquí mismo y queda
            disponible sin conexión.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Archivo de Biblia en formato JSON"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {bible ? (
          <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
            <MetaRow label="Nombre" value={bible.meta.title} />
            <MetaRow label="Abreviatura" value={bible.meta.abbreviation} />
            <MetaRow label="Idioma" value={bible.meta.language} />
            {bible.meta.publisher ? <MetaRow label="Editorial" value={bible.meta.publisher} /> : null}
            {bible.meta.copyright ? <MetaRow label="Derechos" value={bible.meta.copyright} /> : null}
            <MetaRow label="Libros" value={String(bible.meta.bookCount)} />
          </dl>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileJson className="size-6" aria-hidden="true" />
            {stage.step === "reading" ? "Leyendo el archivo…" : "Seleccionar archivo .json"}
          </button>
        )}

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          {bible ? (
            <Button disabled={busy} onClick={() => void handleConfirm(bible)}>
              <Upload aria-hidden="true" />
              {stage.step === "saving" ? "Instalando…" : "Instalar Biblia"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 bg-card px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-foreground">{value}</dd>
    </div>
  );
}
