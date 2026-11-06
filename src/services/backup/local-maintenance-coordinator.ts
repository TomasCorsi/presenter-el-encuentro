import { MAINTENANCE_LEASE_KEY } from "./backup-preferences";
import { isOperationalPath } from "@/pwa/cache-policy";
import { createUuid } from "@/utils/create-id";

interface MaintenanceLease {
  owner: string;
  operation: "backup" | "restore";
  expiresAt: number;
}

function parseLease(value: string | null): MaintenanceLease | null {
  try {
    const parsed = JSON.parse(value ?? "null") as Partial<MaintenanceLease> | null;
    return parsed &&
      typeof parsed.owner === "string" &&
      (parsed.operation === "backup" || parsed.operation === "restore") &&
      typeof parsed.expiresAt === "number"
      ? (parsed as MaintenanceLease)
      : null;
  } catch {
    return null;
  }
}

export async function acquireMaintenanceLease(
  storage: Storage,
  operation: MaintenanceLease["operation"],
): Promise<() => void> {
  const owner = createUuid();
  const current = parseLease(storage.getItem(MAINTENANCE_LEASE_KEY));
  if (current && current.expiresAt > Date.now()) {
    throw new Error("Otra pestaña está ejecutando mantenimiento local.");
  }
  const write = () =>
    storage.setItem(
      MAINTENANCE_LEASE_KEY,
      JSON.stringify({
        owner,
        operation,
        expiresAt: Date.now() + 15_000,
      } satisfies MaintenanceLease),
    );
  write();
  if (parseLease(storage.getItem(MAINTENANCE_LEASE_KEY))?.owner !== owner) {
    throw new Error("Otra pestaña adquirió el mantenimiento local.");
  }
  const heartbeat = window.setInterval(write, 5_000);
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("presenter-maintenance-v1");
  channel?.postMessage({ type: "maintenance-start", owner, operation });
  return () => {
    window.clearInterval(heartbeat);
    if (parseLease(storage.getItem(MAINTENANCE_LEASE_KEY))?.owner === owner) {
      storage.removeItem(MAINTENANCE_LEASE_KEY);
    }
    channel?.postMessage({ type: "maintenance-end", owner });
    channel?.close();
  };
}

export function maintenanceLeaseIsActive(storage: Pick<Storage, "getItem">): boolean {
  const lease = parseLease(storage.getItem(MAINTENANCE_LEASE_KEY));
  return Boolean(lease && lease.expiresAt > Date.now());
}

export async function assertMaintenanceWindowSafety(
  operation: "backup-complete" | "backup-light" | "restore",
): Promise<void> {
  if (operation === "backup-light") return;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("presenter-maintenance-presence-v1");
    const paths = new Set<string>();
    channel.onmessage = (event: MessageEvent<{ type?: string; nonce?: string; path?: string }>) => {
      if (event.data.type === "maintenance-presence" && typeof event.data.path === "string") {
        paths.add(event.data.path);
      }
    };
    channel.postMessage({ type: "maintenance-probe", nonce: createUuid() });
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    channel.close();
    const blocked = [...paths].filter((path) => operation === "restore" || isOperationalPath(path));
    if (blocked.length) {
      throw new Error(`Cerrá las otras ventanas antes de continuar: ${blocked.join(", ")}.`);
    }
    return;
  }
  const response = await new Promise<{ safe: boolean; blocked: string[] }>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(
      () => reject(new Error("El Service Worker no respondió.")),
      3_000,
    );
    channel.port1.onmessage = (event: MessageEvent<{ safe: boolean; blocked: string[] }>) => {
      window.clearTimeout(timeout);
      resolve(event.data);
    };
    navigator.serviceWorker.controller?.postMessage(
      {
        type: "CHECK_MAINTENANCE_SAFETY",
        operation: operation === "restore" ? "restore" : "backup",
      },
      [channel.port2],
    );
  });
  if (!response.safe) {
    throw new Error(`Cerrá las otras ventanas antes de continuar: ${response.blocked.join(", ")}.`);
  }
}
