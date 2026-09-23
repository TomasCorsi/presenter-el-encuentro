import type { RefObject } from "react";
import { useState } from "react";

import type { MediaAsset } from "@/domain/media/media";
import { formatMediaSize, searchMedia } from "@/domain/media/media-rules";

import { LibraryResultRow } from "./library-result-row";

export interface LibraryMediaTabProps {
  assets: readonly MediaAsset[];
  isLoading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  canAdd: boolean;
  busy: boolean;
  onAdd(asset: MediaAsset, mode: "rundown" | "live"): void;
}

/**
 * Tab operativa de Media en la biblioteca de Live: búsqueda local sobre la
 * metadata ya cargada; agregar al rundown o al aire, como Songs y Bible.
 */
export function LibraryMediaTab({
  assets,
  isLoading,
  inputRef,
  canAdd,
  busy,
  onAdd,
}: LibraryMediaTabProps) {
  const [query, setQuery] = useState("");
  const results = searchMedia(assets, query);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar imágenes y videos…"
        aria-label="Buscar en Media"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {isLoading ? (
        <p className="text-xs text-muted-foreground" role="status">Cargando biblioteca…</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {assets.length === 0
            ? "La biblioteca Media está vacía. Importa archivos desde la sección Media."
            : "Sin resultados para esta búsqueda."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Resultados de Media">
          {results.map((asset) => (
            <LibraryResultRow
              key={asset.id}
              title={asset.name}
              subtitle={`${asset.kind === "image" ? "Imagen" : "Video"} · ${formatMediaSize(asset.sizeBytes)}`}
              disabled={!canAdd}
              busy={busy}
              onAdd={() => onAdd(asset, "rundown")}
              onGoLive={() => onAdd(asset, "live")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
