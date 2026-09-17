import { Link } from "@tanstack/react-router";
import { Music } from "lucide-react";

import type { Song } from "@/domain/songs/song";
import { TableCell, TableRow } from "@/components/ui/table";
import { SongActions } from "./song-actions";

export interface SongRowProps {
  song: Song;
  onDuplicate(): Promise<void>;
  onDelete(): Promise<void>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SongRow({ song, ...actions }: SongRowProps) {
  return (
    <TableRow>
      <TableCell className="min-w-0 py-3">
        <Link
          to="/songs/$songId"
          params={{ songId: song.id }}
          className="group inline-flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground group-hover:text-primary">
            <Music className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate font-medium text-foreground group-hover:text-primary">{song.title}</span>
        </Link>
      </TableCell>
      <TableCell className="w-48 truncate text-muted-foreground">{song.author ?? "—"}</TableCell>
      <TableCell className="w-56 whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDate(song.updatedAt)}</TableCell>
      <TableCell className="w-14 text-right"><SongActions song={song} {...actions} /></TableCell>
    </TableRow>
  );
}
