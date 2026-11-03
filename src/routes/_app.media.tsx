import { createFileRoute } from "@tanstack/react-router";
import { CloudUpload, HardDrive, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MEDIA_ACCEPT_ATTRIBUTE, type MediaAsset } from "@/domain/media/media";
import {
  queryMediaLibrary,
  type MediaCollectionFilter,
  type MediaQuickFilter,
  type MediaSort,
} from "@/domain/media/media-rules";
import { MediaAssetCard } from "@/features/media/components/media-asset-card";
import { MediaBulkToolbar } from "@/features/media/components/media-bulk-toolbar";
import { MediaCollectionSidebar } from "@/features/media/components/media-collection-sidebar";
import { MediaInspectorSheet } from "@/features/media/components/media-inspector-sheet";
import { MediaLibraryToolbar } from "@/features/media/components/media-library-toolbar";
import { useMedia } from "@/features/media/media-context";
import { MediaBatchInUseError, MediaInUseError } from "@/features/media/media-service";
import { cn } from "@/lib/utils";

const TITLE = "Media — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Biblioteca local organizada de imágenes y videos lista para presentar sin conexión.";

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
    service,
    storageKind,
    persistenceStatus,
    assets,
    collections,
    preferences,
    isLoading,
    refresh,
    toggleFavorite,
    setFavorites,
    recordRecent,
    setViewMode,
  } = useMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<MediaQuickFilter>("all");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [collectionId, setCollectionId] = useState<MediaCollectionFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setSelectedIds(new Set()), [collectionId, filter, query]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || selectedIds.size === 0) return;
      setSelectedIds(new Set());
      setSelectionMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds.size]);

  const collectionsById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
  );
  const visible = useMemo(
    () =>
      queryMediaLibrary(assets, collections, {
        query: deferredQuery,
        collectionId,
        filter,
        sort,
        favoriteIds: preferences.favoriteIds,
        recentIds: preferences.recentIds,
      }),
    [assets, collectionId, collections, deferredQuery, filter, preferences, sort],
  );
  const counts = useMemo(() => {
    const next = new Map<string, number>([["all", assets.length]]);
    for (const asset of assets) {
      const key =
        asset.collectionId && collectionsById.has(asset.collectionId)
          ? asset.collectionId
          : "unassigned";
      next.set(key, (next.get(key) ?? 0) + 1);
    }
    return next;
  }, [assets, collectionsById]);
  const inspectorAsset = assets.find((asset) => asset.id === inspectorId) ?? null;
  const videoImportable = service.canImport({ mimeType: "video/mp4" });

  const runImport = async (files: Iterable<File>) => {
    const list = [...files];
    if (list.length === 0) return;
    const destination =
      collectionId !== "all" && collectionId !== "unassigned" ? collectionId : undefined;
    setBusy(true);
    try {
      const result = await service.importFiles(
        list,
        destination ? { collectionId: destination } : {},
      );
      for (const error of result.errors) toast.error(error);
      if (result.imported.length > 0) {
        recordRecent(result.imported.map((asset) => asset.id));
        toast.success(`${result.imported.length} archivo(s) importados`);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const createCollection = async (name: string) => {
    try {
      const collection = await service.createCollection(name);
      await refresh();
      setCollectionId(collection.id);
      toast.success(`Colección «${collection.name}» creada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la colección.");
      throw error;
    }
  };

  const renameCollection = async (id: string, name: string) => {
    try {
      await service.renameCollection(id, name);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo renombrar la colección.");
      throw error;
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      await service.deleteCollection(id);
      if (collectionId === id) setCollectionId("unassigned");
      await refresh();
      toast.success("Colección eliminada; sus archivos quedaron sin colección.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la colección.");
    }
  };

  const deleteOne = async (asset: MediaAsset) => {
    try {
      await service.delete(asset.id);
      setInspectorId((current) => (current === asset.id ? null : current));
      await refresh();
      toast.success(`«${asset.name}» eliminado`);
    } catch (error) {
      toast.error(
        error instanceof MediaInUseError ? error.message : "No se pudo eliminar el archivo",
      );
    }
  };

  const runOrganization = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la biblioteca.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    setBusy(true);
    try {
      const result = await service.deleteMany([...selectedIds]);
      if (result.completed.length > 0)
        toast.success(`${result.completed.length} archivo(s) eliminados`);
      if (result.failed.length > 0) {
        toast.error(
          `No se eliminaron: ${result.failed
            .map((item) => `${item.name} (${item.message})`)
            .join(", ")}`,
        );
      }
      setSelectedIds(new Set(result.failed.map((item) => item.mediaId)));
      if (result.failed.length === 0) setSelectionMode(false);
      await refresh();
    } catch (error) {
      if (error instanceof MediaBatchInUseError) {
        toast.error(
          `${error.message} ${error.blocked
            .map((item) => item.usage.projectNames.join(", "))
            .join("; ")}`,
        );
      } else {
        toast.error("No se pudo completar la eliminación múltiple.");
      }
    } finally {
      setBusy(false);
    }
  };

  const loadUsage = useCallback((id: string) => service.usage(id), [service]);
  const checkExists = useCallback((id: string) => service.exists(id), [service]);

  const onDragEnter = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void runImport(event.dataTransfer.files);
  };

  return (
    <Page
      className="relative"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <PageHeader
        eyebrow="Contenido"
        title="Media"
        description="Organiza imágenes y videos locales sin mover sus archivos físicos."
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

      <p className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <HardDrive className="size-3.5" />
        {mounted
          ? `${storageKind.toUpperCase()} · ${persistenceStatus ?? "comprobando persistencia"}`
          : "Comprobando el almacenamiento del navegador…"}
      </p>

      <div className="flex min-h-0 gap-4">
        <MediaCollectionSidebar
          collections={collections}
          value={collectionId}
          counts={counts}
          onChange={setCollectionId}
          onCreate={createCollection}
          onRename={renameCollection}
          onDelete={deleteCollection}
        />
        <main className="min-w-0 flex-1 space-y-3">
          <MediaLibraryToolbar
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            collectionId={collectionId}
            onCollectionChange={setCollectionId}
            collections={collections}
            viewMode={preferences.viewMode}
            onViewModeChange={setViewMode}
            selectionMode={selectionMode}
            onSelectionModeChange={(value) => {
              setSelectionMode(value);
              if (!value) setSelectedIds(new Set());
            }}
            inputRef={searchRef}
          />

          {selectionMode && selectedIds.size > 0 ? (
            <MediaBulkToolbar
              count={selectedIds.size}
              collections={collections}
              onMove={(destination) =>
                void runOrganization(
                  () => service.moveToCollection([...selectedIds], destination),
                  "Colección actualizada",
                )
              }
              onAddTags={(tags) =>
                void runOrganization(
                  () => service.addTags([...selectedIds], tags),
                  "Tags agregados",
                )
              }
              onRemoveTags={(tags) =>
                void runOrganization(
                  () => service.removeTags([...selectedIds], tags),
                  "Tags quitados",
                )
              }
              onFavorite={(favorite) => setFavorites([...selectedIds], favorite)}
              onDelete={() => void deleteSelected()}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando biblioteca…
            </div>
          ) : assets.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="Sin medios todavía"
              description="Importa imágenes o videos para comenzar tu biblioteca."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="Sin resultados"
              description="Cambia la búsqueda, colección o filtros."
            />
          ) : (
            <ul
              className={cn(
                preferences.viewMode === "grid"
                  ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  : "grid gap-1.5",
              )}
            >
              {visible.map((asset) => (
                <MediaAssetCard
                  key={asset.id}
                  asset={asset}
                  collection={
                    asset.collectionId ? collectionsById.get(asset.collectionId) : undefined
                  }
                  viewMode={preferences.viewMode}
                  favorite={preferences.favoriteIds.includes(asset.id)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(asset.id)}
                  onOpen={() => setInspectorId(asset.id)}
                  onToggleFavorite={() => toggleFavorite(asset.id)}
                  onToggleSelected={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(asset.id)) next.delete(asset.id);
                      else next.add(asset.id);
                      return next;
                    })
                  }
                  onDelete={() => void deleteOne(asset)}
                />
              ))}
            </ul>
          )}

          {mounted && !videoImportable ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-500">
              <X className="size-3.5" /> Este navegador no ofrece OPFS: los videos no se pueden
              importar aquí.
            </p>
          ) : null}
        </main>
      </div>

      <MediaInspectorSheet
        asset={inspectorAsset}
        collections={collections}
        favorite={inspectorAsset ? preferences.favoriteIds.includes(inspectorAsset.id) : false}
        storageKind={storageKind}
        persistenceStatus={persistenceStatus}
        open={inspectorAsset !== null}
        onOpenChange={(open) => !open && setInspectorId(null)}
        loadUsage={loadUsage}
        checkExists={checkExists}
        onRename={(id, name) =>
          runOrganization(() => service.rename(id, name), "Nombre actualizado")
        }
        onMove={(id, destination) =>
          runOrganization(() => service.moveToCollection([id], destination), "Colección actualizada")
        }
        onReplaceTags={(id, tags) =>
          runOrganization(() => service.replaceTags(id, tags), "Tags actualizados")
        }
        onToggleFavorite={toggleFavorite}
        onDelete={async (id) => {
          const asset = assets.find((item) => item.id === id);
          if (asset) await deleteOne(asset);
        }}
      />

      {dragging ? (
        <div className="pointer-events-none fixed inset-4 z-50 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/90 backdrop-blur-sm">
          <div className="text-center">
            <CloudUpload className="mx-auto mb-3 size-10 text-primary" />
            <p className="text-lg font-semibold">Soltar para importar</p>
            <p className="text-sm text-muted-foreground">PNG · JPEG · WEBP · MP4 · WEBM</p>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
