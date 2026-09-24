import { ListEnd } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { passageCaption } from "@/domain/bible/bible";
import type { MediaAsset } from "@/domain/media/media";
import type { Preset } from "@/domain/presets/preset";
import type { RundownItem } from "@/domain/projects/rundown";
import type { RundownBackground } from "@/domain/projects/rundown";
import type { Song } from "@/domain/songs/song";
import { RundownRow } from "./rundown-row";

export interface RundownListProps {
  items: RundownItem[];
  songs: Song[];
  media: readonly MediaAsset[];
  presets: readonly Preset[];
  onMove(itemId: string, direction: "up" | "down"): Promise<void>;
  onRemove(itemId: string): Promise<void>;
  /** Media al aire: quitar bloqueado (Fase 10). */
  removeBlockReason?: (itemId: string) => string | null;
  onSetPreset(itemId: string, presetId: string | undefined): Promise<void>;
  onSetBackground?: (itemId: string, background: RundownBackground | undefined) => Promise<void>;
}

export function RundownList({
  items,
  songs,
  media,
  presets,
  onMove,
  onRemove,
  onSetPreset,
  onSetBackground,
  removeBlockReason,
}: RundownListProps) {
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
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  return (
    <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
      {items.map((item, index) => {
        // El pasaje bíblico viaja dentro del item: no depende de que la
        // traducción siga instalada (ADR-042).
        const passage = item.payload?.kind === "bible" ? item.payload.passage : undefined;
        const song = item.type === "song" ? songsById.get(item.sourceId) : undefined;
        const asset = item.type === "media" ? mediaById.get(item.sourceId) : undefined;
        const sourceTitle =
          item.type === "bible"
            ? passage
              ? passageCaption(passage)
              : undefined
            : item.type === "media"
              ? asset?.name
              : song?.title;
        const sourceAuthor =
          item.type === "bible" && passage
            ? `${passage.verses.length} ${passage.verses.length === 1 ? "versículo" : "versículos"}`
            : item.type === "media" && asset
              ? asset.kind === "image"
                ? "Imagen"
                : "Video"
              : song?.author;

        return (
          <RundownRow
            key={item.id}
            item={item}
            position={index + 1}
            sourceTitle={sourceTitle}
            sourceAuthor={sourceAuthor}
            mediaKind={asset?.kind}
            thumbnailDataUrl={asset?.thumbnailDataUrl}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            presets={presets}
            mediaAssets={media}
            onSetPreset={(presetId) => onSetPreset(item.id, presetId)}
            onSetBackground={(background) =>
              onSetBackground?.(item.id, background) ?? Promise.resolve()
            }
            onMove={(direction) => onMove(item.id, direction)}
            onRemove={() => onRemove(item.id)}
            removeBlockReason={removeBlockReason?.(item.id) ?? null}
          />
        );
      })}
    </ol>
  );
}
