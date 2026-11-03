import { Check, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaCollection } from "@/domain/media/media";
import type { MediaCollectionFilter } from "@/domain/media/media-rules";
import { cn } from "@/lib/utils";

export interface MediaCollectionSidebarProps {
  collections: readonly MediaCollection[];
  value: MediaCollectionFilter;
  counts: ReadonlyMap<string, number>;
  onChange(value: MediaCollectionFilter): void;
  onCreate(name: string): Promise<void>;
  onRename(id: string, name: string): Promise<void>;
  onDelete(id: string): Promise<void>;
}

export function MediaCollectionSidebar({
  collections,
  value,
  counts,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: MediaCollectionSidebarProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const row = (id: MediaCollectionFilter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
        value === id ? "bg-primary/15 text-primary" : "hover:bg-muted",
      )}
    >
      <Folder className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );

  return (
    <aside className="hidden w-52 shrink-0 rounded-lg border border-border bg-card p-2 lg:block">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Colecciones
      </h2>
      <div className="space-y-0.5">
        {row("all", "Todos", counts.get("all") ?? 0)}
        {collections.map((collection) => (
          <div key={collection.id} className="group flex items-center gap-0.5">
            {editingId === collection.id ? (
              <>
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="h-8 min-w-0"
                  aria-label={`Renombrar ${collection.name}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => {
                    void onRename(collection.id, editingName)
                      .then(() => setEditingId(null))
                      .catch(() => undefined);
                  }}
                >
                  <Check />
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  {row(collection.id, collection.name, counts.get(collection.id) ?? 0)}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                  aria-label={`Renombrar ${collection.name}`}
                  onClick={() => {
                    setEditingId(collection.id);
                    setEditingName(collection.name);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                  aria-label={`Eliminar colección ${collection.name}`}
                  onClick={() => void onDelete(collection.id)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        ))}
        {row("unassigned", "Sin colección", counts.get("unassigned") ?? 0)}
      </div>
      <div className="mt-3 flex gap-1 border-t border-border pt-3">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nueva colección"
          aria-label="Nombre de nueva colección"
          className="h-8 min-w-0"
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !newName.trim()) return;
            void onCreate(newName).then(() => setNewName("")).catch(() => undefined);
          }}
        />
        <Button
          size="icon"
          className="size-8"
          disabled={!newName.trim()}
          onClick={() =>
            void onCreate(newName).then(() => setNewName("")).catch(() => undefined)
          }
          aria-label="Crear colección"
        >
          <FolderPlus />
        </Button>
      </div>
    </aside>
  );
}
