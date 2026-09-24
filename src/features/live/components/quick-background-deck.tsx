import { Film, Image as ImageIcon, Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import type { MediaAsset } from "@/domain/media/media";
import { searchMedia } from "@/domain/media/media-rules";
import type { RundownBackground } from "@/domain/projects/rundown";
import type { PresentationItem } from "@/domain/presentation/presentation";
import {
  BACKGROUND_PREFERENCES_KEY,
  DEFAULT_BACKGROUND_PREFERENCES,
  parseBackgroundPreferences,
  recordRecentBackground,
  sanitizeBackgroundPreferences,
  toggleBackgroundFavorite,
  type BackgroundPreferences,
} from "@/features/live/background-preferences";
import { cn } from "@/lib/utils";

type Filter = "all" | "favorites" | "recent";

export interface QuickBackgroundDeckProps {
  assets: readonly MediaAsset[];
  inputRef: RefObject<HTMLInputElement | null>;
  target: PresentationItem | null;
  busy: boolean;
  onTransitionChange(transition: BackgroundTransition): void;
  onApply(background: RundownBackground | undefined): Promise<boolean>;
}

export function QuickBackgroundDeck({
  assets,
  inputRef,
  target,
  busy,
  onTransitionChange,
  onApply,
}: QuickBackgroundDeckProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [preferences, setPreferences] = useState<BackgroundPreferences>(
    DEFAULT_BACKGROUND_PREFERENCES,
  );

  useEffect(() => {
    const parsed = parseBackgroundPreferences(
      window.localStorage.getItem(BACKGROUND_PREFERENCES_KEY),
    );
    setPreferences(
      sanitizeBackgroundPreferences(
        parsed,
        assets.map((asset) => asset.id),
      ),
    );
  }, [assets]);

  const persist = (next: BackgroundPreferences) => {
    setPreferences(next);
    window.localStorage.setItem(BACKGROUND_PREFERENCES_KEY, JSON.stringify(next));
  };

  const visible = useMemo(() => {
    const searched = searchMedia(assets, query);
    if (filter === "favorites") {
      return searched.filter((asset) => preferences.favoriteIds.includes(asset.id));
    }
    if (filter === "recent") {
      const order = new Map(preferences.recentIds.map((id, index) => [id, index]));
      return searched
        .filter((asset) => order.has(asset.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    return searched;
  }, [assets, filter, preferences.favoriteIds, preferences.recentIds, query]);

  const apply = async (background: RundownBackground | undefined) => {
    if (!target || busy) return;
    const saved = await onApply(background);
    if (saved && background) persist(recordRecentBackground(preferences, background.mediaId));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {target ? `Aplicar a: ${target.title}` : "Selecciona Song/Bible en Preview o Program."}
        </span>
        <div
          className="ml-auto flex rounded-md border border-border p-0.5"
          aria-label="TransiciÃ³n"
        >
          {(["cut", "fade"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-sm px-2 py-1 text-xs uppercase",
                preferences.transition === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
              onClick={() => {
                const next = { ...preferences, transition: mode };
                persist(next);
                onTransitionChange(mode);
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        {(["all", "favorites", "recent"] as const).map((entry) => (
          <Button
            key={entry}
            type="button"
            size="sm"
            variant={filter === entry ? "secondary" : "ghost"}
            onClick={() => setFilter(entry)}
          >
            {entry === "all" ? "Todos" : entry === "favorites" ? "Favoritos" : "Recientes"}
          </Button>
        ))}
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar fondosâ€¦"
            className="h-8 pl-8"
          />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-7">
        <button
          type="button"
          disabled={!target || busy}
          onClick={() => void apply(undefined)}
          className="grid aspect-video place-items-center rounded-md border border-border bg-muted text-xs disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1">
            <X className="size-3" /> Sin fondo
          </span>
        </button>
        {visible.map((asset) => {
          const favorite = preferences.favoriteIds.includes(asset.id);
          return (
            <div
              key={asset.id}
              className="group relative aspect-video overflow-hidden rounded-md border border-border bg-muted"
            >
              <button
                type="button"
                disabled={!target || busy}
                onClick={() => void apply({ type: "media", mediaId: asset.id })}
                className="h-full w-full disabled:opacity-50"
                title={`Aplicar ${asset.name}`}
              >
                {asset.thumbnailDataUrl ? (
                  <img src={asset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center">
                    {asset.kind === "video" ? <Film /> : <ImageIcon />}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-background/80 px-1 py-0.5 text-[10px]">
                  {asset.kind === "video" ? (
                    <Film className="size-3" />
                  ) : (
                    <ImageIcon className="size-3" />
                  )}
                  <span className="truncate">{asset.name}</span>
                </span>
              </button>
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-background/80 p-1"
                aria-label={`${favorite ? "Quitar" : "Agregar"} ${asset.name} ${favorite ? "de" : "a"} favoritos`}
                onClick={() => persist(toggleBackgroundFavorite(preferences, asset.id))}
              >
                <Star className={cn("size-3", favorite && "fill-current text-primary")} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
