import { ListEnd } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";
import { RundownRow } from "./rundown-row";

export interface RundownListProps {
  items: RundownItem[];
  songs: Song[];
  onMove(itemId: string, direction: "up" | "down"): Promise<void>;
  onRemove(itemId: string): Promise<void>;
}

export function RundownList({ items, songs, onMove, onRemove }: RundownListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListEnd}
        title="Rundown vacío"
        description="Agrega canciones desde la biblioteca para armar la secuencia del evento."
      />
    );
  }

  const songsById = new Map(songs.map((song) => [song.id, song]));

  return (
    <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
      {items.map((item, index) => {
        const song = item.type === "song" ? songsById.get(item.sourceId) : undefined;
        return (
          <RundownRow
            key={item.id}
            item={item}
            position={index + 1}
            sourceTitle={song?.title}
            sourceAuthor={song?.author}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onMove={(direction) => onMove(item.id, direction)}
            onRemove={() => onRemove(item.id)}
          />
        );
      })}
    </ol>
  );
}
