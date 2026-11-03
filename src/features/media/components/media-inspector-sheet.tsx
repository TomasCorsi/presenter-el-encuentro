import { Film, HardDrive, Image as ImageIcon, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MediaAsset, MediaCollection, MediaStorageKind } from "@/domain/media/media";
import { formatMediaSize, type MediaUsage } from "@/domain/media/media-rules";
import { MediaPreviewPlayer } from "@/features/media/components/media-preview-player";
import type { StoragePersistenceStatus } from "@/services/media/storage-persistence";
import { cn } from "@/lib/utils";

export interface MediaInspectorSheetProps {
  asset: MediaAsset | null;
  collections: readonly MediaCollection[];
  favorite: boolean;
  storageKind: MediaStorageKind;
  persistenceStatus: StoragePersistenceStatus | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  loadUsage(id: string): Promise<MediaUsage>;
  checkExists(id: string): Promise<boolean>;
  onRename(id: string, name: string): Promise<void>;
  onMove(id: string, collectionId?: string): Promise<void>;
  onReplaceTags(id: string, tags: string[]): Promise<void>;
  onToggleFavorite(id: string): void;
  onDelete(id: string): Promise<void>;
}

export function MediaInspectorSheet({
  asset,
  collections,
  favorite,
  storageKind,
  persistenceStatus,
  open,
  onOpenChange,
  loadUsage,
  checkExists,
  onRename,
  onMove,
  onReplaceTags,
  onToggleFavorite,
  onDelete,
}: MediaInspectorSheetProps) {
  const [name, setName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [usage, setUsage] = useState<MediaUsage | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(asset?.name ?? "");
    setTagInput(asset?.tags.join(", ") ?? "");
    setUsage(null);
    setExists(null);
    if (!open || !asset) return;
    let cancelled = false;
    void Promise.all([loadUsage(asset.id), checkExists(asset.id)]).then(([nextUsage, nextExists]) => {
      if (cancelled) return;
      setUsage(nextUsage);
      setExists(nextExists);
    });
    return () => {
      cancelled = true;
    };
  }, [asset, checkExists, loadUsage, open]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-8">
          <SheetTitle>{asset?.name ?? "Detalles de Media"}</SheetTitle>
          <SheetDescription>Preview local y metadata de biblioteca.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 grid gap-5">
          <MediaPreviewPlayer asset={asset} active={open} />
          {asset ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="media-inspector-name">Nombre</Label>
                <div className="flex gap-2">
                  <Input id="media-inspector-name" value={name} onChange={(event) => setName(event.target.value)} />
                  <Button disabled={busy || !name.trim() || name.trim() === asset.name} onClick={() => void run(() => onRename(asset.id, name))}>
                    Guardar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-sm">
                <Metadata label="Tipo" value={asset.kind === "image" ? "Imagen" : "Video"} />
                <Metadata label="Formato" value={asset.mimeType} />
                <Metadata label="Tamaño" value={formatMediaSize(asset.sizeBytes)} />
                <Metadata label="Resolución" value={asset.width && asset.height ? `${asset.width}×${asset.height}` : "Sin datos"} />
                {asset.kind === "video" ? (
                  <Metadata label="Duración" value={asset.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : "Sin datos"} />
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Colección</Label>
                <Select
                  value={asset.collectionId ?? "unassigned"}
                  disabled={busy}
                  onValueChange={(value) => void run(() => onMove(asset.id, value === "unassigned" ? undefined : value))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sin colección</SelectItem>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="media-inspector-tags">Tags</Label>
                <div className="flex gap-2">
                  <Input id="media-inspector-tags" value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="worship, azul, loop" />
                  <Button disabled={busy} variant="outline" onClick={() => void run(() => onReplaceTags(asset.id, tagInput.split(",")))}>
                    Guardar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
              </div>

              <Button variant={favorite ? "secondary" : "outline"} onClick={() => onToggleFavorite(asset.id)}>
                <Star className={cn(favorite && "fill-current text-primary")} />
                {favorite ? "Favorito" : "Agregar a favoritos"}
              </Button>

              <section className="grid gap-2 rounded-md border border-border p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4" /> Storage</h3>
                <p className="text-xs text-muted-foreground">
                  {storageKind.toUpperCase()} · {exists === null ? "Comprobando archivo…" : exists ? "Archivo disponible" : "Archivo ausente"}
                </p>
                <p className="text-xs text-muted-foreground">Persistencia: {persistenceStatus ?? "comprobando"}</p>
              </section>

              <section className="grid gap-2 rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">Usado en…</h3>
                {usage === null ? (
                  <p className="text-xs text-muted-foreground">Comprobando referencias…</p>
                ) : usage.references.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No se usa en ningún Project.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {usage.references.map((reference) => (
                      <li key={`${reference.projectId}:${reference.itemId}:${reference.role}`} className="flex gap-2">
                        {reference.role === "content" ? <Film className="size-3.5 shrink-0" /> : <ImageIcon className="size-3.5 shrink-0" />}
                        <span><strong>{reference.projectName}</strong> — {usageRole(reference.role)} · {reference.itemTitle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Button
                variant="destructive"
                disabled={busy || (usage?.occurrences ?? 0) > 0}
                onClick={() => void run(() => onDelete(asset.id))}
              >
                <Trash2 /> {(usage?.occurrences ?? 0) > 0 ? "En uso: no se puede eliminar" : "Eliminar archivo"}
              </Button>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <p><span className="block text-[10px] uppercase text-muted-foreground">{label}</span>{value}</p>;
}

function usageRole(role: MediaUsage["references"][number]["role"]): string {
  if (role === "content") return "como contenido";
  if (role === "song-background") return "background de Song";
  return "background de Bible";
}
