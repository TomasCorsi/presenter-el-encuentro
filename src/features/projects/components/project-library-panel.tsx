import { Film, Image as ImageIcon, Music, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaAsset } from "@/domain/media/media";
import { formatMediaSize, searchMedia } from "@/domain/media/media-rules";
import type { Song } from "@/domain/songs/song";
import { filterSongs } from "@/domain/songs/song-rules";
import { cn } from "@/lib/utils";

type LibraryTab = "songs" | "media";

export interface ProjectLibraryPanelProps {
  songs: readonly Song[];
  songsLoading: boolean;
  media: readonly MediaAsset[];
  mediaLoading: boolean;
  songUsage: ReadonlyMap<string, number>;
  mediaUsage: ReadonlyMap<string, number>;
  onAddSong(song: Song): Promise<void>;
  onAddMedia(asset: MediaAsset): Promise<void>;
}

/**
 * Biblioteca de preparación del Project. Recibe datos de los providers desde
 * la ruta: no crea repositories ni mantiene una fuente paralela de Media.
 */
export function ProjectLibraryPanel({
  songs,
  songsLoading,
  media,
  mediaLoading,
  songUsage,
  mediaUsage,
  onAddSong,
  onAddMedia,
}: ProjectLibraryPanelProps) {
  const [tab, setTab] = useState<LibraryTab>("songs");
  const [query, setQuery] = useState("");
  const visibleSongs = useMemo(() => filterSongs([...songs], query), [query, songs]);
  const visibleMedia = useMemo(() => searchMedia(media, query), [media, query]);
  const loading = tab === "songs" ? songsLoading : mediaLoading;
  const emptyLibrary = tab === "songs" ? songs.length === 0 : media.length === 0;
  const emptyLabel = emptyLibrary ? "La biblioteca está vacía." : "Sin resultados.";

  const switchTab = (next: LibraryTab) => {
    setTab(next);
    setQuery("");
  };

  return (
    <aside
      aria-labelledby="project-library-title"
      className="flex min-h-0 flex-col rounded-md border border-border bg-card"
    >
      <div className="border-b border-border p-3">
        <h2
          id="project-library-title"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Biblioteca
        </h2>
        <div role="tablist" aria-label="Tipos de contenido" className="mb-2 flex gap-1">
          {(["songs", "media"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={tab === entry}
              onClick={() => switchTab(entry)}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === entry
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry === "songs" ? "Songs" : "Media"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "songs" ? "Buscar por título o autor" : "Buscar imágenes y videos"}
            aria-label={tab === "songs" ? "Buscar canciones en la biblioteca" : "Buscar en Media"}
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
            Cargando biblioteca…
          </p>
        ) : tab === "songs" ? (
          visibleSongs.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <ul className="grid gap-0.5">
              {visibleSongs.map((song) => (
                <li
                  key={song.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                >
                  <Music className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{song.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {song.author ?? "Sin autor"}
                      {(songUsage.get(song.id) ?? 0) > 0
                        ? ` · ${songUsage.get(song.id)} en el rundown`
                        : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Agregar ${song.title} al rundown`}
                    onClick={() => {
                      void onAddSong(song).catch(() => undefined);
                    }}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : visibleMedia.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="grid gap-0.5">
            {visibleMedia.map((asset) => {
              const used = mediaUsage.get(asset.id) ?? 0;
              return (
                <li
                  key={asset.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                >
                  {asset.thumbnailDataUrl ? (
                    <img
                      src={asset.thumbnailDataUrl}
                      alt=""
                      className="size-9 shrink-0 rounded-sm border border-border object-cover"
                    />
                  ) : asset.kind === "image" ? (
                    <ImageIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <Film className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{asset.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {asset.kind === "image" ? "Imagen" : "Video"} ·{" "}
                      {formatMediaSize(asset.sizeBytes)}
                      {used > 0 ? ` · ${used} en el rundown` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Agregar ${asset.name} al rundown`}
                    onClick={() => {
                      void onAddMedia(asset).catch(() => undefined);
                    }}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
