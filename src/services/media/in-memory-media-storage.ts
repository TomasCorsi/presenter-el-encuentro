import type { MediaFileStorage, MediaUrlHandle } from "./media-file-storage";

/**
 * Storage en memoria para tests y SSR defensivo. `getUrl` usa
 * `URL.createObjectURL` cuando existe; si no (bun), una URL simbólica.
 */
export function createInMemoryMediaStorage(): MediaFileStorage & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>();

  return {
    kind: "memory",
    files,

    async save(id, file) {
      files.set(id, file);
    },

    async get(id) {
      return files.get(id) ?? null;
    },

    async delete(id) {
      files.delete(id);
    },

    async exists(id) {
      return files.has(id);
    },

    async getUrl(id): Promise<MediaUrlHandle | null> {
      const blob = files.get(id);
      if (!blob) return null;
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        const url = URL.createObjectURL(blob);
        return { url, release: () => URL.revokeObjectURL(url) };
      }
      return { url: `memory://${id}`, release: () => undefined };
    },
  };
}
