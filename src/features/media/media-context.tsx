import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MediaAsset } from "@/domain/media/media";
import type { ProjectService } from "@/features/projects/project-service";
import {
  createIndexedDbBlobMediaStorage,
} from "@/services/media/indexeddb-blob-media-storage";
import { createIndexedDbMediaRepository } from "@/services/media/indexeddb-media-repository";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";
import { createMediaUrlCache, type MediaUrlCache } from "@/services/media/media-url-cache";
import { isOpfsAvailable, createOpfsMediaStorage } from "@/services/media/opfs-media-storage";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import type { MediaRepository } from "@/services/media/media-repository";
import { requestStoragePersistenceOnce } from "@/services/media/storage-persistence";

import { MediaService } from "./media-service";

const MEDIA_WORKSPACE_ID = "local-media";

export interface MediaContextValue {
  service: MediaService;
  /** Caché de URLs locales compartida por toda la ventana. */
  urlCache: MediaUrlCache;
  /** Almacenamiento físico activo (para mostrar el respaldo en la UI). */
  storageKind: MediaFileStorage["kind"];
  assets: MediaAsset[];
  isLoading: boolean;
  /** Cargar/recargar la biblioteca. */
  refresh(): Promise<void>;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export interface MediaProviderProps {
  children: ReactNode;
  projectService: ProjectService;
  /** Inyección para tests. En navegador se derivan del entorno. */
  repository?: MediaRepository;
  fileStorage?: MediaFileStorage;
  /** Precargar assets (tests). */
  initialAssets?: MediaAsset[];
}

/**
 * Provider de Media por ventana. Resuelve el almacenamiento físico:
 * OPFS si está disponible; si no, el respaldo IndexedDB Blob (solo imágenes
 * importables). SSR/tests: implementaciones en memoria.
 */
export function MediaProvider({
  children,
  projectService,
  repository,
  fileStorage,
  initialAssets,
}: MediaProviderProps) {
  const resolved = useMemo(() => {
    if (repository && fileStorage) return { repository, fileStorage };
    if (typeof indexedDB === "undefined") {
      return {
        repository: createInMemoryMediaRepository(),
        fileStorage: createInMemoryMediaStorage(),
      };
    }
    const repo = createIndexedDbMediaRepository(indexedDB);
    const storage = isOpfsAvailable()
      ? createOpfsMediaStorage(
          () => navigator.storage.getDirectory() as unknown as Parameters<
            typeof createOpfsMediaStorage
          >[0] extends never
            ? never
            : never,
        )
      : createIndexedDbBlobMediaStorage(indexedDB);
    return { repository: repo, fileStorage: storage };
  }, [repository, fileStorage]);

  const service = useMemo(
    () =>
      new MediaService(
        resolved.repository,
        resolved.fileStorage,
        projectService,
        MEDIA_WORKSPACE_ID,
      ),
    [resolved, projectService],
  );

  const urlCacheRef = useRef<MediaUrlCache | null>(null);
  if (!urlCacheRef.current) urlCacheRef.current = createMediaUrlCache(resolved.fileStorage);

  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets ?? []);
  const [isLoading, setIsLoading] = useState(initialAssets === undefined);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => cache?.releaseAll();
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setAssets(await service.list());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialAssets !== undefined) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  const value: MediaContextValue = {
    service,
    urlCache: urlCacheRef.current,
    storageKind: resolved.fileStorage.kind,
    assets,
    isLoading,
    refresh,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia(): MediaContextValue {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMedia debe usarse dentro de MediaProvider");
  return context;
}

/**
 * Resuelve la URL local de un asset. `null` mientras carga o si el archivo
 * no está disponible en ESTA ventana (los archivos viven en el dispositivo).
 */
export function useMediaUrl(mediaId: string | null): string | null {
  const { urlCache } = useMedia();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void urlCache.getUrl(mediaId).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId, urlCache]);

  return url;
}

/** Solicita persistencia una vez (se usa al importar el primer archivo). */
export { requestStoragePersistenceOnce };
