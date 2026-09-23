import type { MediaFileStorage, MediaUrlHandle } from "./media-file-storage";

/**
 * Respaldo de bytes en IndexedDB (Blob por id).
 *
 * Alcance LIMITADO: solo imágenes y archivos razonablemente pequeños. Los
 * videos se rechazan cuando OPFS no está disponible (la decisión la toma
 * MediaService): guardar un Blob grande aquí lo materializa en memoria y no
 * garantiza escritura en streaming.
 *
 * Client-only: solo se instancia en el navegador.
 */

const DB_NAME = "broadcast-control.media-files";
const DB_VERSION = 1;
const FILES_STORE = "files";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Error de almacenamiento local."));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("La escritura local fue cancelada."));
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo escribir en el almacenamiento."));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () =>
      reject(open.error ?? new Error("No se pudo abrir el almacenamiento local de Media."));
    open.onblocked = () =>
      reject(new Error("Cierra las demás pestañas de la aplicación e inténtalo de nuevo."));
  });
}

export function createIndexedDbBlobMediaStorage(factory: IDBFactory): MediaFileStorage {
  let connection: Promise<IDBDatabase> | null = null;
  const db = () => (connection ??= openDatabase(factory));

  return {
    kind: "indexeddb-blob",

    async save(id, file) {
      const database = await db();
      const tx = database.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).put(file, id);
      await done(tx);
    },

    async get(id) {
      const database = await db();
      const value = await request(database.transaction(FILES_STORE).objectStore(FILES_STORE).get(id));
      return value instanceof Blob ? value : null;
    },

    async delete(id) {
      const database = await db();
      const tx = database.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).delete(id);
      await done(tx);
    },

    async exists(id) {
      const database = await db();
      const key = await request(
        database.transaction(FILES_STORE).objectStore(FILES_STORE).getKey(id),
      );
      return key !== undefined;
    },

    async getUrl(id): Promise<MediaUrlHandle | null> {
      const blob = await this.get(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      return { url, release: () => URL.revokeObjectURL(url) };
    },
  };
}
