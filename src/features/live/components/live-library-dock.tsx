import { ChevronDown, ChevronUp } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { BiblePassage } from "@/domain/bible/bible";
import type { MediaAsset } from "@/domain/media/media";
import type { Song } from "@/domain/songs/song";
import { cn } from "@/lib/utils";

import { LibraryBibleTab } from "./library-bible-tab";
import { LibraryMediaTab } from "./library-media-tab";
import { LibrarySongsTab } from "./library-songs-tab";

export type LibraryTab = "songs" | "bible" | "media";

export interface LiveLibraryDockProps {
  open: boolean;
  onToggle(): void;
  tab: LibraryTab;
  onTabChange(tab: LibraryTab): void;
  inputRef: RefObject<HTMLInputElement | null>;
  songs: readonly Song[];
  bibleVersionId: string | null;
  onBibleVersionChange(versionId: string): void;
  mediaAssets: readonly MediaAsset[];
  mediaLoading: boolean;
  /** Sin proyecto activo se puede buscar, pero no agregar. */
  canAdd: boolean;
  busy: boolean;
  status: string | null;
  onAddSong(song: Song, mode: "rundown" | "live"): void;
  onAddPassage(passage: BiblePassage, mode: "rundown" | "live"): void;
  onAddMedia(asset: MediaAsset, mode: "rundown" | "live"): void;
}

const TABS: ReadonlyArray<{ id: LibraryTab; label: string }> = [
  { id: "songs", label: "Songs" },
  { id: "bible", label: "Bible" },
  { id: "media", label: "Media" },
];

/**
 * Biblioteca operativa dentro de Live: buscar y agregar sin abandonar la
 * consola. Todo lo que se agrega se guarda en el Project activo; no existe
 * contenido de sesión (ADR-043).
 */
export function LiveLibraryDock({
  open,
  onToggle,
  tab,
  onTabChange,
  inputRef,
  songs,
  bibleVersionId,
  onBibleVersionChange,
  mediaAssets,
  mediaLoading,
  canAdd,
  busy,
  status,
  onAddSong,
  onAddPassage,
  onAddMedia,
}: LiveLibraryDockProps) {
  return (
    <section
      id="live-library-dock"
      aria-label="Biblioteca operativa"
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card",
        open && "h-[clamp(170px,24vh,300px)]",
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <div role="tablist" aria-label="Secciones de la biblioteca" className="flex gap-1">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => onTabChange(entry.id)}
              className={cn(
                "rounded-sm px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === entry.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {status ? (
          <p className="ml-2 min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="live-library-panel"
        >
          {open ? <ChevronDown /> : <ChevronUp />}
          {open ? "Ocultar" : "Biblioteca"}
        </Button>
      </div>

      {open ? (
        <div id="live-library-panel" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          {!canAdd ? (
            <p className="text-xs text-muted-foreground">
              Selecciona un proyecto para agregar contenido al show.
            </p>
          ) : null}

          {tab === "songs" ? (
            <LibrarySongsTab
              songs={songs}
              inputRef={inputRef}
              canAdd={canAdd}
              busy={busy}
              onAdd={onAddSong}
            />
          ) : tab === "bible" ? (
            <LibraryBibleTab
              inputRef={inputRef}
              canAdd={canAdd}
              busy={busy}
              versionId={bibleVersionId}
              onVersionChange={onBibleVersionChange}
              onAdd={onAddPassage}
            />
          ) : (
            <LibraryMediaTab
              assets={mediaAssets}
              isLoading={mediaLoading}
              inputRef={inputRef}
              canAdd={canAdd}
              busy={busy}
              onAdd={onAddMedia}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
