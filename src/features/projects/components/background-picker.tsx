import { Film, Image as ImageIcon, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MediaAsset } from "@/domain/media/media";
import { searchMedia } from "@/domain/media/media-rules";
import type { RundownBackground } from "@/domain/projects/rundown";

export interface BackgroundPickerProps {
  assets: readonly MediaAsset[];
  value: RundownBackground | undefined;
  label: string;
  onChange(background: RundownBackground | undefined): void;
}

export function BackgroundPicker({ assets, value, label, onChange }: BackgroundPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const visible = useMemo(() => searchMedia(assets, query), [assets, query]);
  const selected = assets.find((asset) => asset.id === value?.mediaId);

  const choose = (background: RundownBackground | undefined) => {
    onChange(background);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-36" aria-label={label}>
          {selected?.thumbnailDataUrl ? (
            <img
              src={selected.thumbnailDataUrl}
              alt=""
              className="size-4 rounded-sm object-cover"
            />
          ) : selected?.kind === "video" ? (
            <Film />
          ) : selected ? (
            <ImageIcon />
          ) : (
            <X />
          )}
          <span className="truncate">{selected?.name ?? "Sin fondo"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar fondosâ€¦"
            className="pl-8"
          />
        </div>
        <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
          <button
            type="button"
            className="flex aspect-video items-center justify-center rounded border border-border bg-muted text-xs"
            onClick={() => choose(undefined)}
          >
            Sin fondo
          </button>
          {visible.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="relative aspect-video overflow-hidden rounded border border-border bg-muted text-left"
              onClick={() => choose({ type: "media", mediaId: asset.id })}
              title={asset.name}
            >
              {asset.thumbnailDataUrl ? (
                <img src={asset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center">
                  {asset.kind === "video" ? <Film /> : <ImageIcon />}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-1 py-0.5 text-[10px]">
                {asset.name}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
