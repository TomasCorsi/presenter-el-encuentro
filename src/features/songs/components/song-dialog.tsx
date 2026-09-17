import { useEffect, useState, type FormEvent } from "react";

import { SONG_TITLE_MAX_LENGTH } from "@/domain/songs/song";
import { normalizeSongTitle } from "@/domain/songs/song-rules";
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

export interface SongDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSubmit(title: string, author?: string): Promise<void>;
}

export function SongDialog({ open, onOpenChange, onSubmit }: SongDialogProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setAuthor("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const normalizedTitle = normalizeSongTitle(title);
      setSaving(true);
      await onSubmit(normalizedTitle, author.trim() || undefined);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la canción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md border-border bg-popover">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear canción</DialogTitle>
            <DialogDescription>Añade una canción reutilizable a la biblioteca del workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <div>
              <Label htmlFor="create-song-title">Título</Label>
              <Input
                id="create-song-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={SONG_TITLE_MAX_LENGTH}
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "create-song-error" : undefined}
                className="mt-2"
              />
              {error ? <p id="create-song-error" className="mt-2 text-sm text-destructive">{error}</p> : null}
            </div>
            <div>
              <Label htmlFor="create-song-author">Autor / artista <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="create-song-author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                maxLength={SONG_TITLE_MAX_LENGTH}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creando…" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
