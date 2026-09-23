import type { MediaFileStorage, MediaUrlHandle } from "./media-file-storage";

export interface MediaUrlCache {
  getUrl(mediaId: string): Promise<string | null>;
  invalidate(mediaId: string): void;
  releaseAll(): void;
}

/**
 * Caché de URLs locales por ventana. Resuelve `mediaId → blob: URL` desde el
 * storage local, una vez por asset, y libera todo al cerrar la ventana.
 *
 * Importante: los handles se liberan solo en `invalidate`/`releaseAll`, no
 * por componente — si dos `<video>` comparten la URL, revocarla al
 * desmontar uno rompería el otro.
 */
export function createMediaUrlCache(storage: MediaFileStorage): MediaUrlCache {
  const handles = new Map<string, Promise<MediaUrlHandle | null>>();

  return {
    async getUrl(mediaId) {
      let pending = handles.get(mediaId);
      if (!pending) {
        pending = storage.getUrl(mediaId).catch(() => null);
        handles.set(mediaId, pending);
      }
      const handle = await pending;
      if (!handle) {
        handles.delete(mediaId);
        return null;
      }
      return handle.url;
    },

    invalidate(mediaId) {
      const pending = handles.get(mediaId);
      handles.delete(mediaId);
      void pending?.then((handle) => handle?.release());
    },

    releaseAll() {
      const pending = [...handles.values()];
      handles.clear();
      for (const entry of pending) void entry.then((handle) => handle?.release());
    },
  };
}
