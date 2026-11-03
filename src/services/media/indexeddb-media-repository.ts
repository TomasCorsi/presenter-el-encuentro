import type { MediaAsset, MediaCollection } from "@/domain/media/media";

import {
  parseMediaAsset,
  parseMediaCollection,
  type MediaRepository,
} from "./media-repository";

/**
 * Metadata de Media en IndexedDB (misma filosofía que Bible: la API nativa,
 * sin dependencias). Los BYTES viven en otro lugar (OPFS o el respaldo de
 * blobs); aquí solo hay metadata. Client-only.
 */

const DB_NAME = "broadcast-control.media";
const DB_VERSION = 2;
const ASSETS_STORE = "assets";
const COLLECTIONS_STORE = "collections";

/** Upgrade aditivo: nunca recrea el store de assets ni toca el DB separado de bytes. */
export function upgradeMediaDatabase(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(ASSETS_STORE)) {
    database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(COLLECTIONS_STORE)) {
    database.createObjectStore(COLLECTIONS_STORE, { keyPath: "id" });
  }
}

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
      upgradeMediaDatabase(open.result);
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
      return values
        .map(parseMediaAsset)
        .filter((asset): asset is MediaAsset => asset !== null);
    },

    async get(id) {
      const database = await db();
      const value = await request(
        database.transaction(ASSETS_STORE).objectStore(ASSETS_STORE).get(id),
      );
      return parseMediaAsset(value);
    },

    async put(asset: MediaAsset) {
      const database = await db();
      const tx = database.transaction(ASSETS_STORE, "readwrite");
      tx.objectStore(ASSETS_STORE).put(asset);
      await done(tx);
    },

    async putMany(assets: readonly MediaAsset[]) {
      if (assets.length === 0) return;
      const database = await db();
      const tx = database.transaction(ASSETS_STORE, "readwrite");
      const store = tx.objectStore(ASSETS_STORE);
      for (const asset of assets) store.put(asset);
      await done(tx);
    },

    async delete(id) {
      const database = await db();
      const tx = database.transaction(ASSETS_STORE, "readwrite");
      tx.objectStore(ASSETS_STORE).delete(id);
      await done(tx);
    },

    async listCollections() {
      const database = await db();
      const values = await request(
        database.transaction(COLLECTIONS_STORE).objectStore(COLLECTIONS_STORE).getAll(),
      );
      return values
        .map(parseMediaCollection)
        .filter((collection): collection is MediaCollection => collection !== null);
    },

    async getCollection(id) {
      const database = await db();
      const value = await request(
        database.transaction(COLLECTIONS_STORE).objectStore(COLLECTIONS_STORE).get(id),
      );
      return parseMediaCollection(value);
    },

    async putCollection(collection: MediaCollection) {
      const database = await db();
      const tx = database.transaction(COLLECTIONS_STORE, "readwrite");
      tx.objectStore(COLLECTIONS_STORE).put(collection);
      await done(tx);
    },

    async deleteCollectionAndUnassign(id, updatedAt) {
      const database = await db();
      const tx = database.transaction([ASSETS_STORE, COLLECTIONS_STORE], "readwrite");
      const assetsStore = tx.objectStore(ASSETS_STORE);
      const values = await request(assetsStore.getAll());
      for (const value of values) {
        const asset = parseMediaAsset(value);
        if (!asset || asset.collectionId !== id) continue;
        assetsStore.put({ ...asset, collectionId: undefined, updatedAt });
      }
      tx.objectStore(COLLECTIONS_STORE).delete(id);
      await done(tx);
    },
  };
}
