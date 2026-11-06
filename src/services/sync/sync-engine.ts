import {
  SYNC_ENTITY_TYPES,
  createSyncEntityKey,
  type SyncConflict,
  type SyncLink,
} from "@/domain/sync/sync";
import { CloudRepositoryError } from "@/services/cloud/cloud-error";
import { createUuid } from "@/utils/create-id";
import type { SyncCloudGateway } from "./sync-cloud-gateway";
import type { SyncLocalStore } from "./sync-local-store";
import { canAutoRetry, retryDelayMilliseconds } from "./sync-rules";

export class SyncEngine {
  readonly #owner = createUuid();
  #running: Promise<void> | null = null;

  constructor(
    private readonly local: SyncLocalStore,
    private readonly cloud: SyncCloudGateway,
    private readonly online: () => boolean = () => navigator.onLine,
    private readonly now: () => Date = () => new Date(),
  ) {}

  run(): Promise<void> {
    if (this.#running) return this.#running;
    this.#running = this.#cycle().finally(() => {
      this.#running = null;
    });
    return this.#running;
  }

  async #cycle(): Promise<void> {
    let link = await this.local.getActiveLink();
    if (!link || link.state !== "active") return;
    if (!this.online()) return;
    await this.#pullAll(link);
    await this.#flush(link);
    link = await this.local.getActiveLink();
    if (!link || link.state !== "active") return;
    await this.#pullAll(link);
    link = await this.local.getActiveLink();
    if (link?.state === "active") await this.local.markCycleComplete(link);
  }

  async #pullAll(initial: SyncLink): Promise<void> {
    for (const type of SYNC_ENTITY_TYPES) {
      for (;;) {
        const current = await this.local.getActiveLink();
        if (!current || current.linkKey !== initial.linkKey || current.state !== "active") return;
        const rows = await this.cloud.pull(
          current.cloudWorkspaceId,
          type,
          current.checkpoints[type],
        );
        if (rows.length === 0) break;
        await this.local.applyPullPage(current, type, rows);
        if (rows.length < 200) break;
      }
    }
  }

  async #flush(link: SyncLink): Promise<void> {
    for (;;) {
      if (!this.online()) return;
      const entry = await this.local.claimNext(link.linkKey, this.#owner);
      if (!entry) return;
      try {
        const result = await this.cloud.apply(link.cloudWorkspaceId, entry);
        if (result.outcome === "conflict") {
          await this.local.addConflict(
            {
              key: createSyncEntityKey(link.linkKey, entry.entityType, entry.entityId),
              linkKey: link.linkKey,
              entityType: entry.entityType,
              entityId: entry.entityId,
              kind: result.row?.deletedAt
                ? "update-tombstone"
                : entry.operation === "delete"
                  ? "delete-update"
                  : "update-update",
              localSnapshot: entry.payload,
              cloud: result.row,
              detectedAt: this.now().toISOString(),
            } satisfies SyncConflict,
            entry.operationId,
          );
          continue;
        }
        if (!result.row) throw new Error("La operación sync no devolvió la fila aplicada.");
        await this.local.completePush(entry, result.row);
      } catch (error) {
        const normalized =
          error instanceof CloudRepositoryError
            ? error
            : new CloudRepositoryError(
                "unknown",
                error instanceof Error ? error.message : "Error de sync",
              );
        if (normalized.code === "unauthorized") {
          await this.local.pauseLink(link, normalized.message);
          return;
        }
        const attempts = entry.attempts + 1;
        const retry = normalized.code === "network" || normalized.code === "unknown";
        const { leaseOwner: _owner, leaseUntil: _until, ...clean } = entry;
        await this.local.updateQueue({
          ...clean,
          attempts,
          state: retry && canAutoRetry(attempts) ? "pending" : "error",
          nextRetryAt: new Date(
            this.now().getTime() +
              retryDelayMilliseconds(attempts, Math.random, normalized.retryAfterMs),
          ).toISOString(),
          lastError: normalized.message,
        });
        if (!retry) continue;
        return;
      }
    }
  }
}
