import type { SyncQueueEntry } from "@/domain/sync/sync";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            ![
              "workspaceId",
              "sync_revision",
              "sync_change_seq",
              "last_operation_id",
              "deleted_at",
            ].includes(key),
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalSyncJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function syncFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalSyncJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function retryDelayMilliseconds(
  attempt: number,
  random = Math.random,
  retryAfterMs?: number,
): number {
  if (retryAfterMs !== undefined) return Math.max(0, retryAfterMs);
  const base = Math.min(900_000, 5_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.8 + random() * 0.4));
}

export function canAutoRetry(attempts: number): boolean {
  return attempts < 10;
}

export function queueResponseIsCurrent(
  current: SyncQueueEntry | undefined,
  sent: Pick<SyncQueueEntry, "operationId" | "generation">,
): boolean {
  return current?.operationId === sent.operationId && current.generation === sent.generation;
}
