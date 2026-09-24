/**
 * Persistencia de almacenamiento local (navigator.storage.persist).
 *
 * Se SOLICITA una vez por dispositivo al importar el primer archivo, sin
 * bloquear la importación: persistir reduce el riesgo de que el navegador
 * limpie los datos bajo presión de espacio, pero no es una garantía
 * absoluta — el navegador conserva la última palabra.
 */

const PERSIST_REQUESTED_KEY = "broadcast-control.persist-requested";

export type StoragePersistenceStatus = "unsupported" | "not-persistent" | "persistent";

export interface StoragePersistenceDependencies {
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  manager?: Pick<StorageManager, "persisted" | "persist"> | null;
}

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function browserStorageManager(): Pick<StorageManager, "persisted" | "persist"> | null {
  if (typeof navigator === "undefined" || !navigator.storage) return null;
  return navigator.storage;
}

export async function storagePersistenceStatus(
  manager: Pick<StorageManager, "persisted"> | null = browserStorageManager(),
): Promise<StoragePersistenceStatus> {
  if (!manager || typeof manager.persisted !== "function") {
    return "unsupported";
  }
  try {
    return (await manager.persisted()) ? "persistent" : "not-persistent";
  } catch {
    return "unsupported";
  }
}

/**
 * Consulta el estado y, si hace falta, solicita persistencia una sola vez por
 * dispositivo. Nunca lanza y devuelve el estado observado tras el intento.
 */
export async function requestStoragePersistenceOnce(
  dependencies: StoragePersistenceDependencies = {},
): Promise<StoragePersistenceStatus> {
  const storage = dependencies.storage === undefined ? browserStorage() : dependencies.storage;
  const manager =
    dependencies.manager === undefined ? browserStorageManager() : dependencies.manager;

  if (
    !storage ||
    !manager ||
    typeof manager.persisted !== "function" ||
    typeof manager.persist !== "function"
  ) {
    return "unsupported";
  }

  try {
    if (await manager.persisted()) return "persistent";
  } catch {
    return "unsupported";
  }

  if (storage.getItem(PERSIST_REQUESTED_KEY)) return "not-persistent";

  // Se registra antes del await para que dos importaciones simultáneas no
  // disparen dos solicitudes.
  storage.setItem(PERSIST_REQUESTED_KEY, "1");
  try {
    return (await manager.persist()) ? "persistent" : "not-persistent";
  } catch {
    // El navegador puede rechazar la solicitud: la importación continúa igual.
    return "not-persistent";
  }
}

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
}

export async function readStorageEstimate(): Promise<StorageEstimate | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.usage !== "number" || typeof estimate.quota !== "number") return null;
    return { usageBytes: estimate.usage, quotaBytes: estimate.quota };
  } catch {
    return null;
  }
}
