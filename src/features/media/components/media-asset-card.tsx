import { Film, Image as ImageIcon, MoreHorizontal, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import { formatMediaSize } from "@/domain/media/media-rules";
import type { MediaLibraryViewMode } from "@/features/media/media-library-preferences";
import { cn } from "@/lib/utils";

export interface MediaAssetCardProps {
  asset: MediaAsset;
  collection?: MediaCollection | undefined;
  viewMode: MediaLibraryViewMode;
  favorite: boolean;
  selectionMode: boolean;
  selected: boolean;
  onOpen(): void;
  onToggleFavorite(): void;
  onToggleSelected(): void;
  onDelete(): void;
}

export function MediaAssetCard({
  asset,
  collection,
  viewMode,
  favorite,
  selectionMode,
  selected,
  onOpen,
  onToggleFavorite,
  onToggleSelected,
  onDelete,
}: MediaAssetCardProps) {
  const isVideo = asset.kind === "video";
  const activate = () => (selectionMode ? onToggleSelected() : onOpen());
  const thumbnail = asset.thumbnailDataUrl ? (
    <img src={asset.thumbnailDataUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <span className="grid h-full place-items-center text-muted-foreground">
      {isVideo ? <Film /> : <ImageIcon />}
    </span>
  );

  if (viewMode === "compact") {
    return (
      <li
        className={cn(
          "flex items-center gap-3 rounded-md border bg-card p-2",
          selected ? "border-primary bg-primary/5" : "border-border",
        )}
        style={{ contentVisibility: "auto", containIntrinsicSize: "64px" }}
      >
        {selectionMode ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelected}
            aria-label={`Seleccionar ${asset.name}`}
          />
        ) : null}
        <button
          type="button"
          onClick={activate}
          className="h-12 w-20 shrink-0 overflow-hidden rounded bg-muted"
          aria-label={selectionMode ? `Seleccionar ${asset.name}` : `Abrir detalles de ${asset.name}`}
        >
          {thumbnail}
        </button>
        <button type="button" onClick={activate} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">{asset.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {isVideo ? "Video" : "Imagen"} · {formatMediaSize(asset.sizeBytes)}
            {collection ? ` · ${collection.name}` : " · Sin colección"}
          </span>
        </button>
        {isVideo && asset.durationSeconds ? (
          <Badge variant="outline">{Math.round(asset.durationSeconds)}s</Badge>
        ) : null}
        <CardActions
          name={asset.name}
          favorite={favorite}
          onFavorite={onToggleFavorite}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group overflow-hidden rounded-lg border bg-card",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      <div className="relative aspect-video bg-muted">
        <button
          type="button"
          className="h-full w-full"
          onClick={activate}
          aria-label={selectionMode ? `Seleccionar ${asset.name}` : `Abrir detalles de ${asset.name}`}
        >
          {thumbnail}
        </button>
        {selectionMode ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelected}
            aria-label={`Seleccionar ${asset.name}`}
            className="absolute left-2 top-2 bg-background"
          />
        ) : null}
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute right-2 top-2 rounded bg-background/85 p-1.5"
          aria-label={`${favorite ? "Quitar" : "Agregar"} ${asset.name} ${favorite ? "de" : "a"} favoritos`}
        >
          <Star className={cn("size-4", favorite && "fill-current text-primary")} />
        </button>
        <span className="absolute bottom-2 left-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
          {isVideo ? (asset.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : "Video") : "Imagen"}
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={activate} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">{asset.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {collection?.name ?? "Sin colección"}
          </span>
        </button>
        <CardActions
          name={asset.name}
          favorite={favorite}
          onFavorite={onToggleFavorite}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

function CardActions({
  name,
  favorite,
  onFavorite,
  onOpen,
  onDelete,
}: {
  name: string;
  favorite: boolean;
  onFavorite(): void;
  onOpen(): void;
  onDelete(): void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>Detalles</DropdownMenuItem>
        <DropdownMenuItem onClick={onFavorite}>
          <Star className={cn(favorite && "fill-current")} />
          {favorite ? "Quitar favorito" : "Agregar favorito"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
