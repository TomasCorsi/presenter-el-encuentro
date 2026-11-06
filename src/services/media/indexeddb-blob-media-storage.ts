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

export function createIndexedDbBlobMediaStorage(
  factory: IDBFactory,
  generation = "legacy",
): MediaFileStorage & { clearGeneration(): Promise<void> } {
  let connection: Promise<IDBDatabase> | null = null;
  const db = () => (connection ??= openDatabase(factory));
  const key = (id: string) => (generation === "legacy" ? id : `${generation}|${id}`);

  return {
    kind: "indexeddb-blob",

    async save(id, file) {
      const database = await db();
      const tx = database.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).put(file, key(id));
      await done(tx);
    },

    async saveStream(id, stream, mimeType) {
      const blob = await new Response(stream).blob();
      await this.save(id, blob.type ? blob : new Blob([blob], { type: mimeType }));
    },

    async get(id) {
      const database = await db();
      const value = await request(
        database.transaction(FILES_STORE).objectStore(FILES_STORE).get(key(id)),
      );
      return value instanceof Blob ? value : null;
    },

    async delete(id) {
      const database = await db();
      const tx = database.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).delete(key(id));
      await done(tx);
    },

    async exists(id) {
      const database = await db();
      const storedKey = await request(
        database.transaction(FILES_STORE).objectStore(FILES_STORE).getKey(key(id)),
      );
      return storedKey !== undefined;
    },

    async getUrl(id): Promise<MediaUrlHandle | null> {
      const blob = await this.get(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      return { url, release: () => URL.revokeObjectURL(url) };
    },

    async clearGeneration() {
      if (generation === "legacy") return;
      const database = await db();
      const tx = database.transaction(FILES_STORE, "readwrite");
      const store = tx.objectStore(FILES_STORE);
      const cursor = store.openKeyCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        if (String(current.key).startsWith(`${generation}|`)) current.delete();
        current.continue();
      };
      await done(tx);
    },
  };
}
