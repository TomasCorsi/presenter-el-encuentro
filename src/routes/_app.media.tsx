import { createFileRoute } from "@tanstack/react-router";
import { Check, CloudUpload, Film, HardDrive, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MEDIA_ACCEPT_ATTRIBUTE, type MediaAsset } from "@/domain/media/media";
import { formatMediaSize } from "@/domain/media/media-rules";
import { useMedia, useMediaUrl } from "@/features/media/media-context";
import { MediaInUseError } from "@/features/media/media-service";
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
  const { service, storageKind, assets, isLoading, refresh } = useMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const videoImportable = service.canImport({ mimeType: "video/mp4" });

  const runImport = async (files: Iterable<File>) => {
    const list = [...files];
    if (list.length === 0) return;
    setBusy(true);
    const result = await service.importFiles(list);
    setBusy(false);
    for (const error of result.errors) toast.error(error);
    if (result.imported.length > 0) {
      toast.success(`${result.imported.length} archivo(s) importados`);
    }
    await refresh();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void runImport(event.dataTransfer.files);
  };

  const onDelete = async (asset: MediaAsset) => {
    try {
      await service.delete(asset.id);
      toast.success(`«${asset.name}» eliminado`);
    } catch (error) {
      if (error instanceof MediaInUseError) toast.error(error.message);
      else toast.error("No se pudo eliminar el archivo");
    }
    await refresh();
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
        <p className="text-xs text-muted-foreground">PNG · JPEG · WEBP · MP4 · WEBM</p>
      </div>

      {/* Estado de almacenamiento */}
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <HardDrive className="h-3.5 w-3.5" />
        {storageKind === "opfs"
          ? "Almacenamiento OPFS: imágenes y videos, persistente mientras el navegador lo permita."
          : "Almacenamiento limitado del navegador: solo imágenes. La persistencia no está garantizada."}
      </p>

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

      {!videoImportable ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-500">
          <X className="h-3.5 w-3.5" />
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
        {isVideo && url ? (
          <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
        ) : !isVideo && url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
        ) : asset.thumbnailDataUrl ? (
          <img src={asset.thumbnailDataUrl} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
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
        {isVideo ? (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
            <Check className="hidden" />
            {asset.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : "Video"}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={asset.name}>{asset.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatMediaSize(asset.sizeBytes)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {asset.mimeType.split("/")[1]}
        </Badge>
      </div>
    </li>
  );
}
