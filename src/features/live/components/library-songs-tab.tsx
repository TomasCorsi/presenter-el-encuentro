import { useMemo, useState, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import type { Song } from "@/domain/songs/song";
import { searchSongs } from "@/features/live/library-search";

import { LibraryResultRow } from "./library-result-row";

export interface LibrarySongsTabProps {
  songs: readonly Song[];
  inputRef: RefObject<HTMLInputElement | null>;
  canAdd: boolean;
  busy: boolean;
  onAdd(song: Song, mode: "rundown" | "live"): void;
}

/** Búsqueda de Songs sobre la biblioteca ya cargada en memoria. */
export function LibrarySongsTab({ songs, inputRef, canAdd, busy, onAdd }: LibrarySongsTabProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSongs(songs, query), [query, songs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar canción por título o autor…"
        aria-label="Buscar canción"
        className="h-8"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No hay canciones que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Resultados de canciones">
            {results.map((song) => (
              <LibraryResultRow
                key={song.id}
                title={song.title}
                subtitle={`${song.author ? `${song.author} · ` : ""}${song.sections.length} secciones`}
                disabled={!canAdd}
                busy={busy}
                onAdd={() => onAdd(song, "rundown")}
                onGoLive={() => onAdd(song, "live")}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
