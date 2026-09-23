import { createFileRoute } from "@tanstack/react-router";
import { Check, CloudUpload, Film, HardDrive, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MEDIA_ACCEPT_ATTRIBUTE,
  formatMediaSize,
  type MediaAsset,
} from "@/domain/media/media";
import { MediaInUseError } from "@/features/media/media-service";
import { useMedia, useMediaUrl } from "@/features/media/media-context";
import { cn } from "@/lib/utils";

const TITLE = "Media — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Biblioteca local de imágenes y videos (PNG, JPEG, WEBP, MP4, WEBM) lista para presentar sin conexión.";

export const Route = createFileRoute("/_app/media")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const {
    assets, isLoading, storage, persistence, quota, canImport, importFiles, remove,
  } = useMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const runImport = async (files: Iterable<File>) => {
    const list = [...files];
    if (list.length === 0) return;
    setBusy(true);
    const result = await importFiles(list);
    setBusy(false);
    for (const failure of result.failures) toast.error(`${failure.name}: ${failure.reason}`);
    if (result.imported.length > 0) toast.success(`${result.imported.length} archivo(s) importados`);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void runImport(event.dataTransfer.files);
  };

  const onDelete = async (asset: MediaAsset) => {
    try {
      await remove(asset.id);
      toast.success(`"${asset.name}" eliminado`);
    } catch (error) {
      if (error instanceof MediaInUseError) {
        const projects = error.projectNames.slice(0, 3).join(", ");
        toast.error(
          `"${asset.name}" está en uso en ${error.occurrences} elemento(s)` +
          (projects ? ` de: ${projects}` : "") + ". Quítalo del proyecto primero.",
        );
      } else {
        toast.error("No se pudo eliminar el archivo");
      }
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Contenido"
        title="Media"
        description="Imágenes y videos locales: se presentan sin conexión y sin depender de Internet."
        actions={
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            Importar
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void runImport(event.target.files ?? []);
          event.target.value = "";
        }}
      />

      {/* Zona de importación */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Soltar archivos para importar"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6",
          "cursor-pointer text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/40",
        )}
      >
        <CloudUpload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Arrastra archivos o haz clic para importar</p>
        <p className="text-xs text-muted-foreground">PNG · JPEG · WEBP · MP4 · WEBM — máx. 20 GB por archivo</p>
      </div>

      {/* Estado de almacenamiento */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          {storage === "opfs"
            ? "Almacenamiento OPFS (imágenes y video)"
            : "Almacenamiento limitado del navegador (solo imágenes)"}
        </span>
        {persistence === "granted" ? (
          <span className="inline-flex items-center gap-1 text-emerald-500">
            <Check className="h-3.5 w-3.5" /> Persistente
          </span>
        ) : persistence === "denied" ? (
          <span className="inline-flex items-center gap-1 text-amber-500">
            <X className="h-3.5 w-3.5" /> El navegador puede liberar espacio bajo presión
          </span>
        ) : null}
        {quota ? (
          <span>
            {formatMediaSize(quota.usage)} usados de {formatMediaSize(quota.quota)}
          </span>
        ) : null}
      </div>

      {/* Biblioteca */}
      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando biblioteca…
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Sin medios todavía"
            description="Importa imágenes o videos: podrás agregarlos al proyecto desde Projects o desde el dock de Live."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <MediaCard key={asset.id} asset={asset} onDelete={() => void onDelete(asset)} />
            ))}
          </ul>
        )}
      </div>

      {!canImport("video") ? (
        <p className="mt-4 text-xs text-amber-500">
          Este navegador no ofrece OPFS: los videos (MP4/WEBM) no se pueden importar aquí.
        </p>
      ) : null}
    </Page>
  );
}

function MediaCard({ asset, onDelete }: { asset: MediaAsset; onDelete: () => void }) {
  const url = useMediaUrl(asset.id);
  const isVideo = asset.kind === "video";

  return (
    <li className="group overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-video bg-muted">
        {isVideo ? (
          <video src={url ?? undefined} muted preload="metadata" className="h-full w-full object-cover" />
        ) : url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {isVideo ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Eliminar ${asset.name}`}
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={asset.name}>{asset.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatMediaSize(asset.size)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {isVideo && asset.durationSeconds ? ` · ${Math.round(asset.durationSeconds)}s` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {asset.mimeType.split("/")[1]}
        </Badge>
      </div>
    </li>
  );
}
