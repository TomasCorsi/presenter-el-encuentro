import { Grid2X2, List, Search } from "lucide-react";
import type { RefObject } from "react";

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
import type {
  MediaCollectionFilter,
  MediaQuickFilter,
  MediaSort,
} from "@/domain/media/media-rules";
import type { MediaLibraryViewMode } from "@/features/media/media-library-preferences";

const FILTERS: ReadonlyArray<{ id: MediaQuickFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "image", label: "Imágenes" },
  { id: "video", label: "Videos" },
  { id: "favorites", label: "Favoritos" },
  { id: "recent", label: "Recientes" },
];

export interface MediaLibraryToolbarProps {
  query: string;
  onQueryChange(value: string): void;
  filter: MediaQuickFilter;
  onFilterChange(value: MediaQuickFilter): void;
  sort: MediaSort;
  onSortChange(value: MediaSort): void;
  collectionId: MediaCollectionFilter;
  onCollectionChange(value: MediaCollectionFilter): void;
  collections: readonly MediaCollection[];
  viewMode: MediaLibraryViewMode;
  onViewModeChange(value: MediaLibraryViewMode): void;
  selectionMode: boolean;
  onSelectionModeChange(value: boolean): void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function MediaLibraryToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  collectionId,
  onCollectionChange,
  collections,
  viewMode,
  onViewModeChange,
  selectionMode,
  onSelectionModeChange,
  inputRef,
}: MediaLibraryToolbarProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por nombre, tag o colección…"
            className="pl-9"
          />
        </div>
        <Select value={collectionId} onValueChange={onCollectionChange}>
          <SelectTrigger className="w-44 lg:hidden" aria-label="Colección">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Sin colección</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => onSortChange(value as MediaSort)}>
          <SelectTrigger className="w-44" aria-label="Ordenar Media">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Más recientes</SelectItem>
            <SelectItem value="name-asc">Nombre A–Z</SelectItem>
            <SelectItem value="name-desc">Nombre Z–A</SelectItem>
            <SelectItem value="size">Mayor tamaño</SelectItem>
            <SelectItem value="duration">Mayor duración</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border p-0.5">
          <Button
            type="button"
            size="icon"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            className="size-8"
            onClick={() => onViewModeChange("grid")}
            aria-label="Vista de grilla"
          >
            <Grid2X2 />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={viewMode === "compact" ? "secondary" : "ghost"}
            className="size-8"
            onClick={() => onViewModeChange("compact")}
            aria-label="Vista compacta"
          >
            <List />
          </Button>
        </div>
        <Button
          type="button"
          variant={selectionMode ? "secondary" : "outline"}
          onClick={() => onSelectionModeChange(!selectionMode)}
        >
          {selectionMode ? "Cancelar selección" : "Seleccionar"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtros de Media">
        {FILTERS.map((entry) => (
          <Button
            key={entry.id}
            type="button"
            size="sm"
            variant={filter === entry.id ? "secondary" : "ghost"}
            onClick={() => onFilterChange(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
