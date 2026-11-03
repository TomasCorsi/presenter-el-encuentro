import { Film, Image as ImageIcon, Star } from "lucide-react";
import type { RefObject } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaAsset } from "@/domain/media/media";
import type { MediaCollection } from "@/domain/media/media";
import {
  formatMediaSize,
  queryMediaLibrary,
  type MediaCollectionFilter,
  type MediaQuickFilter,
} from "@/domain/media/media-rules";
import { MediaPreviewDialog } from "@/features/media/components/media-preview-dialog";
import type { MediaLibraryPreferences } from "@/features/media/media-library-preferences";
import { cn } from "@/lib/utils";

import { LibraryResultRow } from "./library-result-row";

export interface LibraryMediaTabProps {
  assets: readonly MediaAsset[];
  collections: readonly MediaCollection[];
  preferences: MediaLibraryPreferences;
  isLoading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  canAdd: boolean;
  busy: boolean;
  onAdd(asset: MediaAsset, mode: "rundown" | "live"): void;
  onToggleFavorite(mediaId: string): void;
}

/**
 * Tab operativa de Media en la biblioteca de Live: búsqueda local sobre la
 * metadata ya cargada; agregar al rundown o al aire, como Songs y Bible.
 */
export function LibraryMediaTab({
  assets,
  collections,
  preferences,
  isLoading,
  inputRef,
  canAdd,
  busy,
  onAdd,
  onToggleFavorite,
}: LibraryMediaTabProps) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [collectionId, setCollectionId] = useState<MediaCollectionFilter>("all");
  const [filter, setFilter] = useState<MediaQuickFilter>("all");
  const results = useMemo(
    () =>
      queryMediaLibrary(assets, collections, {
        query,
        collectionId,
        filter,
        favoriteIds: preferences.favoriteIds,
        recentIds: preferences.recentIds,
        sort: "name-asc",
        limit: 60,
      }),
    [assets, collectionId, collections, filter, preferences, query],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar Media…"
          aria-label="Buscar en Media"
          className="min-w-44 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Select value={collectionId} onValueChange={setCollectionId}>
          <SelectTrigger className="h-8 w-40" aria-label="Colección Media"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {collections.map((collection) => <SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>)}
            <SelectItem value="unassigned">Sin colección</SelectItem>
          </SelectContent>
        </Select>
        {(["all", "image", "video", "favorites", "recent"] as const).map((entry) => (
          <Button key={entry} size="sm" variant={filter === entry ? "secondary" : "ghost"} onClick={() => setFilter(entry)}>
            {entry === "all" ? "Todos" : entry === "image" ? "Imágenes" : entry === "video" ? "Videos" : entry === "favorites" ? "Favoritos" : "Recientes"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground" role="status">Cargando biblioteca…</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {assets.length === 0
            ? "La biblioteca Media está vacía. Importa archivos desde la sección Media."
            : "Sin resultados para esta búsqueda."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Resultados de Media">
          {results.map((asset) => (
            <LibraryResultRow
              key={asset.id}
              title={asset.name}
              subtitle={`${asset.kind === "image" ? "Imagen" : "Video"} · ${formatMediaSize(asset.sizeBytes)}`}
              leading={
                <span className="relative grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                  {asset.thumbnailDataUrl ? <img src={asset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" /> : asset.kind === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
                  {preferences.favoriteIds.includes(asset.id) ? <Star className={cn("absolute right-0.5 top-0.5 size-3 fill-current text-primary")} /> : null}
                </span>
              }
              secondaryAction={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onToggleFavorite(asset.id)}
                  aria-label={`${preferences.favoriteIds.includes(asset.id) ? "Quitar" : "Agregar"} ${asset.name} ${preferences.favoriteIds.includes(asset.id) ? "de" : "a"} favoritos`}
                >
                  <Star className={cn("size-4", preferences.favoriteIds.includes(asset.id) && "fill-current text-primary")} />
                </Button>
              }
              disabled={!canAdd}
              busy={busy}
              onAdd={() => onAdd(asset, "rundown")}
              onGoLive={() => onAdd(asset, "live")}
              onPreview={() => setPreview(asset)}
            />
          ))}
        </ul>
      )}
      <MediaPreviewDialog
        asset={preview}
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      />
    </div>
  );
}
