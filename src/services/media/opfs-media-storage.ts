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
const MEDIA_GENERATIONS_DIRECTORY = "media-generations";

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
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
};

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

const supportsMove =
  typeof FileSystemFileHandle !== "undefined" && "move" in FileSystemFileHandle.prototype;

/** Storage OPFS del navegador. Lanza si OPFS no está disponible. */
export function createBrowserOpfsMediaStorage(generation = "legacy"): MediaFileStorage {
  return createOpfsMediaStorage(
    () => navigator.storage.getDirectory() as unknown as Promise<DirectoryHandle>,
    undefined,
    generation,
  );
}

export async function deleteBrowserOpfsMediaGeneration(generation: string): Promise<void> {
  if (generation === "legacy") return;
  const root = (await navigator.storage.getDirectory()) as unknown as DirectoryHandle;
  try {
    const generations = await root.getDirectoryHandle(MEDIA_GENERATIONS_DIRECTORY);
    await generations.removeEntry(generation, { recursive: true });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

export function createOpfsMediaStorage(
  getRoot: () => Promise<DirectoryHandle>,
  canMoveFiles: boolean = supportsMove,
  generation = "legacy",
): MediaFileStorage {
  let directory: Promise<DirectoryHandle> | null = null;
  const mediaDir = () =>
    (directory ??= getRoot().then(async (root) => {
      if (generation === "legacy") {
        return root.getDirectoryHandle(MEDIA_DIRECTORY, { create: true });
      }
      const generations = await root.getDirectoryHandle(MEDIA_GENERATIONS_DIRECTORY, {
        create: true,
      });
      return generations.getDirectoryHandle(generation, { create: true });
    }));

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
      return this.saveStream(id, file.stream(), file.type);
    },

    async saveStream(id, stream) {
      const dir = await mediaDir();
      const tempName = `${id}.part`;
      const targetName = canMoveFiles ? tempName : id;
      try {
        const handle = await dir.getFileHandle(targetName, { create: true });
        const writable = await handle.createWritable();
        await stream.pipeTo(writable);
        if (canMoveFiles) {
          await removeQuietly(dir, id);
          await (handle as unknown as { move(name: string): Promise<void> }).move(id);
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
