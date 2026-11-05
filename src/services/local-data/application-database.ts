export const APPLICATION_DB_NAME = "broadcast-control.app";
export const APPLICATION_DB_VERSION = 2;

export const APPLICATION_STORES = {
  projects: "projects",
  songs: "songs",
  presets: "presets",
  meta: "meta",
  syncLinks: "sync_links",
  syncEntities: "sync_entities",
  syncQueue: "sync_queue",
  syncConflicts: "sync_conflicts",
} as const;

export interface ApplicationMetaRecord<T = unknown> {
  key: string;
  value: T;
}

const connections = new WeakMap<IDBFactory, Promise<IDBDatabase>>();

export function upgradeApplicationDatabase(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(APPLICATION_STORES.projects)) {
    database.createObjectStore(APPLICATION_STORES.projects, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.songs)) {
    database.createObjectStore(APPLICATION_STORES.songs, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.presets)) {
    database.createObjectStore(APPLICATION_STORES.presets, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.meta)) {
    database.createObjectStore(APPLICATION_STORES.meta, { keyPath: "key" });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.syncLinks)) {
    const store = database.createObjectStore(APPLICATION_STORES.syncLinks, { keyPath: "key" });
    store.createIndex("by_state", "state", { unique: false });
    store.createIndex("by_link", "linkKey", { unique: false });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.syncEntities)) {
    const store = database.createObjectStore(APPLICATION_STORES.syncEntities, { keyPath: "key" });
    store.createIndex("by_link", "linkKey", { unique: false });
    store.createIndex("by_link_entity", ["linkKey", "entityType", "entityId"], { unique: false });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.syncQueue)) {
    const store = database.createObjectStore(APPLICATION_STORES.syncQueue, {
      keyPath: "operationId",
    });
    store.createIndex("by_link", "linkKey", { unique: false });
    store.createIndex("by_link_entity", ["linkKey", "entityType", "entityId"], { unique: false });
    store.createIndex("by_link_state_retry", ["linkKey", "state", "nextRetryAt"], {
      unique: false,
    });
  }
  if (!database.objectStoreNames.contains(APPLICATION_STORES.syncConflicts)) {
    const store = database.createObjectStore(APPLICATION_STORES.syncConflicts, { keyPath: "key" });
    store.createIndex("by_link", "linkKey", { unique: false });
    store.createIndex("by_link_entity", ["linkKey", "entityType", "entityId"], { unique: false });
  }
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Error de almacenamiento local."));
  });
}

export function idbTransactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("La escritura local fue cancelada."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("No se pudo escribir en el almacenamiento local."));
  });
}

export function openApplicationDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const existing = connections.get(factory);
  if (existing) return existing;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(APPLICATION_DB_NAME, APPLICATION_DB_VERSION);
    request.onupgradeneeded = () => upgradeApplicationDatabase(request.result);
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        connections.delete(factory);
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir el almacenamiento de la aplicación."));
    request.onblocked = () =>
      reject(
        new Error(
          "La actualización del almacenamiento local está bloqueada por otra pestaña. " +
            "Cerrá las demás ventanas y reintentá; tus datos no fueron borrados.",
        ),
      );
  });

  connections.set(factory, opening);
  void opening.catch(() => connections.delete(factory));
  return opening;
}

export async function closeApplicationDatabase(factory: IDBFactory): Promise<void> {
  const connection = connections.get(factory);
  connections.delete(factory);
  if (connection) (await connection).close();
}
