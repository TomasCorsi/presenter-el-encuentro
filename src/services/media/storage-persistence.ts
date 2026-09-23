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

export async function storagePersistenceStatus(): Promise<StoragePersistenceStatus> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persisted !== "function"
  ) {
    return "unsupported";
  }
  try {
    return (await navigator.storage.persisted()) ? "persistent" : "not-persistent";
  } catch {
    return "unsupported";
  }
}

/** Solicita persistencia una sola vez por dispositivo. Nunca lanza. */
export async function requestStoragePersistenceOnce(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(PERSIST_REQUESTED_KEY)) return;
  localStorage.setItem(PERSIST_REQUESTED_KEY, "1");
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.persist === "function"
    ) {
      await navigator.storage.persist();
    }
  } catch {
    // El navegador puede rechazarlo: la importación continúa igual.
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
