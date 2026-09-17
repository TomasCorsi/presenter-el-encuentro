import type { Song } from "@/domain/songs/song";

/**
 * Búsqueda local de la biblioteca operativa de Live. Pura y sin dependencias:
 * opera sobre las Songs ya cargadas en memoria, nunca sobre la persistencia.
 */

const MAX_RESULTS = 60;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Coincidencia por título o autor; sin consulta devuelve el principio de la lista. */
export function searchSongs(songs: readonly Song[], query: string): Song[] {
  const needle = normalize(query);
  const ordered = [...songs].sort((a, b) => a.title.localeCompare(b.title, "es"));
  if (!needle) return ordered.slice(0, MAX_RESULTS);

  return ordered
    .filter(
      (song) =>
        normalize(song.title).includes(needle) || normalize(song.author ?? "").includes(needle),
    )
    .slice(0, MAX_RESULTS);
}
