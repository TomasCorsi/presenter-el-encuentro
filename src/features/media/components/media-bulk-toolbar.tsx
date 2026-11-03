import { FolderInput, Star, StarOff, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaCollection } from "@/domain/media/media";

export interface MediaBulkToolbarProps {
  count: number;
  collections: readonly MediaCollection[];
  onMove(collectionId?: string): void;
  onAddTags(tags: string[]): void;
  onRemoveTags(tags: string[]): void;
  onFavorite(favorite: boolean): void;
  onDelete(): void;
  onClear(): void;
}

export function MediaBulkToolbar({
  count,
  collections,
  onMove,
  onAddTags,
  onRemoveTags,
  onFavorite,
  onDelete,
  onClear,
}: MediaBulkToolbarProps) {
  const [tagInput, setTagInput] = useState("");
  const tags = () => tagInput.split(",").map((tag) => tag.trim()).filter(Boolean);

  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-card p-2 shadow-lg">
      <strong className="px-1 text-sm">{count} seleccionados</strong>
      <Select value="" onValueChange={(value) => onMove(value === "unassigned" ? undefined : value)}>
        <SelectTrigger className="h-8 w-44" aria-label="Mover seleccionados">
          <FolderInput /> <SelectValue placeholder="Mover a…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Sin colección</SelectItem>
          {collections.map((collection) => (
            <SelectItem key={collection.id} value={collection.id}>
              {collection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={tagInput}
        onChange={(event) => setTagInput(event.target.value)}
        placeholder="tags separados por coma"
        className="h-8 w-48"
        aria-label="Tags para selección"
      />
      <Button size="sm" variant="outline" disabled={tags().length === 0} onClick={() => onAddTags(tags())}>
        <Tags /> Agregar
      </Button>
      <Button size="sm" variant="outline" disabled={tags().length === 0} onClick={() => onRemoveTags(tags())}>
        <Tags /> Quitar
      </Button>
      <Button size="icon" variant="outline" className="size-8" onClick={() => onFavorite(true)} aria-label="Marcar favoritos">
        <Star />
      </Button>
      <Button size="icon" variant="outline" className="size-8" onClick={() => onFavorite(false)} aria-label="Quitar favoritos">
        <StarOff />
      </Button>
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 /> Eliminar
      </Button>
      <Button size="icon" variant="ghost" className="ml-auto size-8" onClick={onClear} aria-label="Limpiar selección">
        <X />
      </Button>
    </div>
  );
}
