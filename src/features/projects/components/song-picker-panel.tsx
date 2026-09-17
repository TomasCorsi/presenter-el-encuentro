import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Song } from "@/domain/songs/song";
import { filterSongs } from "@/domain/songs/song-rules";

export interface SongPickerPanelProps {
  songs: Song[];
  loading: boolean;
  /** Cuántas veces está ya cada canción en el rundown actual. */
  usageBySongId: ReadonlyMap<string, number>;
  onAdd(song: Song): Promise<void>;
}

/**
 * Panel persistente de biblioteca. Permite agregar varias canciones seguidas
 * sin abandonar la pantalla del project. Repetir una canción es válido.
 */
export function SongPickerPanel({ songs, loading, usageBySongId, onAdd }: SongPickerPanelProps) {
  const [query, setQuery] = useState("");
  const visibleSongs = useMemo(() => filterSongs(songs, query), [songs, query]);

  return (
    <aside aria-labelledby="song-picker-title" className="flex min-h-0 flex-col rounded-md border border-border bg-card">
      <div className="border-b border-border p-3">
        <h2 id="song-picker-title" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Biblioteca
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título o autor"
            aria-label="Buscar canciones en la biblioteca"
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Cargando canciones…</p>
        ) : visibleSongs.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {songs.length === 0 ? "La biblioteca está vacía." : "Sin resultados."}
          </p>
        ) : (
          <ul className="grid gap-0.5">
            {visibleSongs.map((song) => {
              const used = usageBySongId.get(song.id) ?? 0;
              return (
                <li key={song.id} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{song.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {song.author ?? "Sin autor"}{used > 0 ? ` · ${used} en el rundown` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Agregar ${song.title} al rundown`}
                    onClick={() => { void onAdd(song).catch(() => undefined); }}
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
