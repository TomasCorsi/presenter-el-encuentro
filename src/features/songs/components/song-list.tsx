import { SearchX } from "lucide-react";

import type { Song } from "@/domain/songs/song";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SongRow } from "./song-row";

export interface SongListProps {
  songs: Song[];
  hasQuery: boolean;
  onDuplicate(id: string): Promise<void>;
  onDelete(id: string): Promise<void>;
}

export function SongList({ songs, hasQuery, ...actions }: SongListProps) {
  if (songs.length === 0 && hasQuery) {
    return <EmptyState icon={SearchX} title="Sin resultados" description="Prueba con otro título o autor." />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Canción</TableHead><TableHead>Autor</TableHead>
            <TableHead>Última modificación</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {songs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              onDuplicate={() => actions.onDuplicate(song.id)}
              onDelete={() => actions.onDelete(song.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
