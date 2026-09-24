import { ListEnd } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { passageCaption } from "@/domain/bible/bible";
import type { Preset } from "@/domain/presets/preset";
import type { RundownItem } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";
import { RundownRow } from "./rundown-row";

export interface RundownListProps {
  items: RundownItem[];
  songs: Song[];
  presets: readonly Preset[];
  onMove(itemId: string, direction: "up" | "down"): Promise<void>;
  onRemove(itemId: string): Promise<void>;
  /** Media al aire: quitar bloqueado (Fase 10). */
  isRemoveBlocked?: (itemId: string) => boolean;
  onSetPreset(itemId: string, presetId: string | undefined): Promise<void>;
}

export function RundownList({ items, songs, presets, onMove, onRemove, onSetPreset, isRemoveBlocked }: RundownListProps) {
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
        // El pasaje bíblico viaja dentro del item: no depende de que la
        // traducción siga instalada (ADR-042).
        const passage = item.payload?.kind === "bible" ? item.payload.passage : undefined;
        const song = item.type === "song" ? songsById.get(item.sourceId) : undefined;
        const sourceTitle =
          item.type === "bible" ? (passage ? passageCaption(passage) : undefined) : song?.title;
        const sourceAuthor =
          item.type === "bible" && passage
            ? `${passage.verses.length} ${passage.verses.length === 1 ? "versículo" : "versículos"}`
            : song?.author;

        return (
          <RundownRow
            key={item.id}
            item={item}
            position={index + 1}
            sourceTitle={sourceTitle}
            sourceAuthor={sourceAuthor}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            presets={presets}
            onSetPreset={(presetId) => onSetPreset(item.id, presetId)}
            onMove={(direction) => onMove(item.id, direction)}
            onRemove={() => onRemove(item.id)}
            removeBlocked={isRemoveBlocked?.(item.id) ?? false}
          />
        );
      })}
    </ol>
  );
}
