import type { MediaFileStorage, MediaUrlHandle } from "./media-file-storage";

/**
 * Almacenamiento de bytes en OPFS (Origin Private File System).
 *
 * Escritura en STREAMING: `file.stream().pipeTo(writable)` — un video grande
 * nunca se materializa entero en memoria. Se escribe en un temporal
 * (`<id>.part`) y se renombra al final cuando el navegador soporta `move`,
 * así un fallo a mitad nunca deja un archivo a medias con nombre válido.
 *
 * Client-only: solo se instancia en el navegador.
 */

const MEDIA_DIRECTORY = "media";

export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage !== "undefined" &&
    typeof navigator.storage.getDirectory === "function"
  );
}

type DirectoryHandle = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string): Promise<void>;
};

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

const supportsMove =
  typeof FileSystemFileHandle !== "undefined" && "move" in FileSystemFileHandle.prototype;

/** Storage OPFS del navegador. Lanza si OPFS no está disponible. */
export function createBrowserOpfsMediaStorage(): MediaFileStorage {
  return createOpfsMediaStorage(
    () => navigator.storage.getDirectory() as unknown as Promise<DirectoryHandle>,
  );
}

export function createOpfsMediaStorage(
  getRoot: () => Promise<DirectoryHandle>,
): MediaFileStorage {
  let directory: Promise<DirectoryHandle> | null = null;
  const mediaDir = () =>
    (directory ??= getRoot().then((root) =>
      root.getDirectoryHandle(MEDIA_DIRECTORY, { create: true }),
    ));

  async function removeQuietly(dir: DirectoryHandle, name: string): Promise<void> {
    try {
      await dir.removeEntry(name);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  return {
    kind: "opfs",

    async save(id, file) {
      const dir = await mediaDir();
      const tempName = `${id}.part`;
      const targetName = supportsMove ? tempName : id;
      try {
        const handle = await dir.getFileHandle(targetName, { create: true });
        const writable = await handle.createWritable();
        await file.stream().pipeTo(writable);
        if (supportsMove) {
          await removeQuietly(dir, id);
          await (
            handle as unknown as { move(name: string): Promise<void> }
          ).move(id);
        }
      } catch (error) {
        // Compensación local: nada queda a medias con nombre válido.
        await removeQuietly(dir, tempName).catch(() => undefined);
        await removeQuietly(dir, id).catch(() => undefined);
        throw error;
      }
    },

    async get(id) {
      const dir = await mediaDir();
      try {
        const handle = await dir.getFileHandle(id);
        return await handle.getFile();
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async delete(id) {
      const dir = await mediaDir();
      await removeQuietly(dir, id);
    },

    async exists(id) {
      const dir = await mediaDir();
      try {
        await dir.getFileHandle(id);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },

    async getUrl(id): Promise<MediaUrlHandle | null> {
      const file = await this.get(id);
      if (!file) return null;
      const url = URL.createObjectURL(file);
      return { url, release: () => URL.revokeObjectURL(url) };
    },
  };
}
