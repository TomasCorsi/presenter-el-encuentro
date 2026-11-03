import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import type { ProjectRepository } from "@/services/projects/project-repository";
import { createIndexedDbBlobMediaStorage } from "@/services/media/indexeddb-blob-media-storage";
import { createIndexedDbMediaRepository } from "@/services/media/indexeddb-media-repository";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";
import { createMediaUrlCache, type MediaUrlCache } from "@/services/media/media-url-cache";
import {
  createBrowserOpfsMediaStorage,
  isOpfsAvailable,
} from "@/services/media/opfs-media-storage";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import type { MediaRepository } from "@/services/media/media-repository";
import {
  requestStoragePersistenceOnce,
  storagePersistenceStatus,
  type StoragePersistenceStatus,
} from "@/services/media/storage-persistence";

import { MediaService } from "./media-service";
import {
  DEFAULT_MEDIA_LIBRARY_PREFERENCES,
  readMediaLibraryPreferences,
  recordRecentMedia,
  sanitizeMediaLibraryPreferences,
  setMediaFavorite,
  toggleMediaFavorite,
  writeMediaLibraryPreferences,
  type MediaLibraryPreferences,
  type MediaLibraryViewMode,
} from "./media-library-preferences";
import { readVisualMediaInfo } from "./read-media-info";

const MEDIA_WORKSPACE_ID = "local-media";

export interface MediaContextValue {
  service: MediaService;
  /** Caché de URLs locales compartida por toda la ventana. */
  urlCache: MediaUrlCache;
  /** Almacenamiento físico activo (para mostrar el respaldo en la UI). */
  storageKind: MediaFileStorage["kind"];
  /** Estado real informado por StorageManager; `null` mientras se consulta. */
  persistenceStatus: StoragePersistenceStatus | null;
  assets: MediaAsset[];
  collections: MediaCollection[];
  preferences: MediaLibraryPreferences;
  isLoading: boolean;
  /** Cargar/recargar la biblioteca. */
  refresh(): Promise<void>;
  toggleFavorite(id: string): void;
  setFavorites(ids: readonly string[], favorite: boolean): void;
  recordRecent(ids: readonly string[]): void;
  setViewMode(viewMode: MediaLibraryViewMode): void;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export interface MediaProviderProps {
  children: ReactNode;
  /** Referencias de Projects para el bloqueo de eliminación en uso. */
  projectRepository?: Pick<ProjectRepository, "list"> | undefined;
  /** Inyección para tests. En navegador se derivan del entorno. */
  repository?: MediaRepository;
  fileStorage?: MediaFileStorage;
  /** Precargar assets (tests). */
  initialAssets?: MediaAsset[];
  initialCollections?: MediaCollection[];
  initialPreferences?: MediaLibraryPreferences;
}

/**
 * Provider de Media por ventana. Resuelve el almacenamiento físico:
 * OPFS si está disponible; si no, el respaldo IndexedDB Blob (solo imágenes
 * importables). SSR/tests: implementaciones en memoria.
 */
export function MediaProvider({
  children,
  projectRepository,
  repository,
  fileStorage,
  initialAssets,
  initialCollections,
  initialPreferences,
}: MediaProviderProps) {
  const resolved = useMemo(() => {
    if (repository && fileStorage) return { repository, fileStorage };
    if (typeof indexedDB === "undefined") {
      return {
        repository: createInMemoryMediaRepository(),
        fileStorage: createInMemoryMediaStorage(),
      };
    }
    return {
      repository: createIndexedDbMediaRepository(indexedDB),
      fileStorage: isOpfsAvailable()
        ? createBrowserOpfsMediaStorage()
        : createIndexedDbBlobMediaStorage(indexedDB),
    };
  }, [repository, fileStorage]);

  const resolvedProjects = useMemo<Pick<ProjectRepository, "list">>(() => {
    if (projectRepository) return projectRepository;
    return { list: async () => [] };
  }, [projectRepository]);

  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets ?? []);
  const [collections, setCollections] = useState<MediaCollection[]>(initialCollections ?? []);
  const [isLoading, setIsLoading] = useState(initialAssets === undefined);
  const [persistenceStatus, setPersistenceStatus] = useState<StoragePersistenceStatus | null>(null);
  const [preferences, setPreferences] = useState<MediaLibraryPreferences>(
    initialPreferences ?? DEFAULT_MEDIA_LIBRARY_PREFERENCES,
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(initialPreferences !== undefined);

  const prepareStorage = useCallback(async () => {
    const status = await requestStoragePersistenceOnce();
    setPersistenceStatus(status);
  }, []);

  const service = useMemo(
    () =>
      new MediaService(
        resolved.repository,
        resolved.fileStorage,
        resolvedProjects,
        MEDIA_WORKSPACE_ID,
        () => new Date(),
        () => crypto.randomUUID(),
        readVisualMediaInfo,
        prepareStorage,
      ),
    [prepareStorage, resolved, resolvedProjects],
  );

  const urlCacheRef = useRef<MediaUrlCache | null>(null);
  if (!urlCacheRef.current) urlCacheRef.current = createMediaUrlCache(resolved.fileStorage);

  useEffect(() => {
    void storagePersistenceStatus().then(setPersistenceStatus);
  }, []);

  useEffect(() => {
    if (initialPreferences !== undefined || typeof window === "undefined") return;
    setPreferences(readMediaLibraryPreferences(window.localStorage));
    setPreferencesLoaded(true);
  }, [initialPreferences]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => cache?.releaseAll();
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [nextAssets, nextCollections] = await Promise.all([
        service.list(),
        service.listCollections(),
      ]);
      setAssets(nextAssets);
      setCollections(nextCollections);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialAssets !== undefined) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  useEffect(() => {
    if (!preferencesLoaded || isLoading) return;
    setPreferences((current) => {
      const next = sanitizeMediaLibraryPreferences(
        current,
        assets.map((asset) => asset.id),
      );
      if (typeof window !== "undefined") writeMediaLibraryPreferences(window.localStorage, next);
      return next;
    });
  }, [assets, isLoading, preferencesLoaded]);

  const updatePreferences = useCallback(
    (update: (current: MediaLibraryPreferences) => MediaLibraryPreferences) => {
      setPreferences((current) => {
        const next = update(current);
        if (typeof window !== "undefined") writeMediaLibraryPreferences(window.localStorage, next);
        return next;
      });
    },
    [],
  );

  const value: MediaContextValue = {
    service,
    urlCache: urlCacheRef.current,
    storageKind: resolved.fileStorage.kind,
    persistenceStatus,
    assets,
    collections,
    preferences,
    isLoading,
    refresh,
    toggleFavorite: (id) => updatePreferences((current) => toggleMediaFavorite(current, id)),
    setFavorites: (ids, favorite) =>
      updatePreferences((current) => setMediaFavorite(current, ids, favorite)),
    recordRecent: (ids) => updatePreferences((current) => recordRecentMedia(current, ids)),
    setViewMode: (viewMode) => updatePreferences((current) => ({ ...current, viewMode })),
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
