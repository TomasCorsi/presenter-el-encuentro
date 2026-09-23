import type { MediaAsset } from "@/domain/media/media";

import { isMediaAsset, type MediaRepository } from "./media-repository";

/**
 * Metadata de Media en IndexedDB (misma filosofía que Bible: la API nativa,
 * sin dependencias). Los BYTES viven en otro lugar (OPFS o el respaldo de
 * blobs); aquí solo hay metadata. Client-only.
 */

const DB_NAME = "broadcast-control.media";
const DB_VERSION = 1;
const ASSETS_STORE = "assets";

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
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: "id" });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () =>
      reject(open.error ?? new Error("No se pudo abrir el almacenamiento local de Media."));
    open.onblocked = () =>
      reject(new Error("Cierra las demás pestañas de la aplicación e inténtalo de nuevo."));
  });
}

export function createIndexedDbMediaRepository(factory: IDBFactory): MediaRepository {
  let connection: Promise<IDBDatabase> | null = null;
  const db = () => (connection ??= openDatabase(factory));

  return {
    async list() {
      const database = await db();
      const values = await request(
        database.transaction(ASSETS_STORE).objectStore(ASSETS_STORE).getAll(),
      );
      return values.filter(isMediaAsset);
    },

    async get(id) {
      const database = await db();
      const value = await request(
        database.transaction(ASSETS_STORE).objectStore(ASSETS_STORE).get(id),
      );
      return isMediaAsset(value) ? value : null;
    },

    async put(asset: MediaAsset) {
      const database = await db();
      const tx = database.transaction(ASSETS_STORE, "readwrite");
      tx.objectStore(ASSETS_STORE).put(asset);
      await done(tx);
    },

    async delete(id) {
      const database = await db();
      const tx = database.transaction(ASSETS_STORE, "readwrite");
      tx.objectStore(ASSETS_STORE).delete(id);
      await done(tx);
    },
  };
}
