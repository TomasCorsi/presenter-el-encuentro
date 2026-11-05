import { DEFAULT_PRESET_ID } from "@/domain/presets/preset";
import {
  createSyncEntityKey,
  type SyncEntityMetadata,
  type SyncEntityType,
  type SyncLink,
  type SyncQueueEntry,
} from "@/domain/sync/sync";
import {
  APPLICATION_STORES,
  idbRequest,
  type ApplicationMetaRecord,
} from "@/services/local-data/application-database";

export const ACTIVE_SYNC_LINK_META_KEY = "activeSyncLinkKey";
export const SYNC_WRITE_STORES = [
  APPLICATION_STORES.meta,
  APPLICATION_STORES.syncLinks,
  APPLICATION_STORES.syncEntities,
  APPLICATION_STORES.syncQueue,
] as const;

export async function commitJournalOrAbort(
  transaction: IDBTransaction,
  completed: Promise<void>,
  journal: Promise<void>,
): Promise<void> {
  try {
    await journal;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have aborted because of the failed request.
    }
    await completed.catch(() => undefined);
    throw error;
  }
}

const operationId = (): string => crypto.randomUUID();

async function activeLink(transaction: IDBTransaction): Promise<SyncLink | null> {
  const pointer = await idbRequest<ApplicationMetaRecord<string> | undefined>(
    transaction.objectStore(APPLICATION_STORES.meta).get(ACTIVE_SYNC_LINK_META_KEY),
  );
  if (typeof pointer?.value !== "string") return null;
  const link = await idbRequest<SyncLink | undefined>(
    transaction.objectStore(APPLICATION_STORES.syncLinks).get(pointer.value),
  );
  return link?.state === "active" ? link : null;
}

async function currentQueue(
  transaction: IDBTransaction,
  linkKey: string,
  entityType: SyncEntityType,
  entityId: string,
): Promise<SyncQueueEntry | undefined> {
  const entries = await idbRequest<SyncQueueEntry[]>(
    transaction
      .objectStore(APPLICATION_STORES.syncQueue)
      .index("by_link_entity")
      .getAll([linkKey, entityType, entityId]),
  );
  return entries.find((entry) => entry.state !== "archived");
}

export async function journalLocalUpsert(
  transaction: IDBTransaction,
  entityType: SyncEntityType,
  entity: { id: string },
  now = new Date().toISOString(),
): Promise<void> {
  if (entityType === "preset" && entity.id === DEFAULT_PRESET_ID) return;
  const link = await activeLink(transaction);
  if (!link) return;
  const key = createSyncEntityKey(link.linkKey, entityType, entity.id);
  const metadataStore = transaction.objectStore(APPLICATION_STORES.syncEntities);
  const metadata = await idbRequest<SyncEntityMetadata | undefined>(metadataStore.get(key));
  const nextRevision = (metadata?.localRevision ?? 0) + 1;
  const nextMetadata: SyncEntityMetadata = metadata
    ? { ...metadata, localRevision: nextRevision }
    : {
        key,
        linkKey: link.linkKey,
        entityType,
        entityId: entity.id,
        localRevision: nextRevision,
        syncedLocalRevision: 0,
        cloudRevision: null,
        lastSyncedFingerprint: null,
        lastSyncedAt: null,
      };
  metadataStore.put(nextMetadata);

  const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
  const queued = await currentQueue(transaction, link.linkKey, entityType, entity.id);
  if (queued) {
    queueStore.put({
      ...queued,
      operation: "upsert",
      payload: structuredClone(entity),
      localRevision: nextRevision,
      generation: queued.generation + 1,
      updatedAt: now,
      state: "pending",
      attempts: 0,
      nextRetryAt: now,
      leaseOwner: undefined,
      leaseUntil: undefined,
      lastError: undefined,
    });
  } else {
    const entry: SyncQueueEntry = {
      operationId: operationId(),
      linkKey: link.linkKey,
      entityType,
      entityId: entity.id,
      operation: "upsert",
      payload: structuredClone(entity),
      expectedCloudRevision: metadata?.cloudRevision ?? null,
      localRevision: nextRevision,
      generation: 1,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      nextRetryAt: now,
      state: "pending",
    };
    queueStore.add(entry);
  }
}

export async function journalLocalDelete(
  transaction: IDBTransaction,
  entityType: SyncEntityType,
  entityId: string,
  now = new Date().toISOString(),
): Promise<void> {
  if (entityType === "preset" && entityId === DEFAULT_PRESET_ID) return;
  const link = await activeLink(transaction);
  if (!link) return;
  const key = createSyncEntityKey(link.linkKey, entityType, entityId);
  const metadataStore = transaction.objectStore(APPLICATION_STORES.syncEntities);
  const metadata = await idbRequest<SyncEntityMetadata | undefined>(metadataStore.get(key));
  const queued = await currentQueue(transaction, link.linkKey, entityType, entityId);
  const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);

  if ((metadata?.cloudRevision ?? null) === null && queued?.operation === "upsert") {
    queueStore.delete(queued.operationId);
    metadataStore.delete(key);
    return;
  }

  const nextRevision = (metadata?.localRevision ?? 0) + 1;
  metadataStore.put(
    metadata
      ? { ...metadata, localRevision: nextRevision }
      : ({
          key,
          linkKey: link.linkKey,
          entityType,
          entityId,
          localRevision: nextRevision,
          syncedLocalRevision: 0,
          cloudRevision: null,
          lastSyncedFingerprint: null,
          lastSyncedAt: null,
        } satisfies SyncEntityMetadata),
  );
  if (queued) {
    queueStore.put({
      ...queued,
      operation: "delete",
      payload: null,
      localRevision: nextRevision,
      generation: queued.generation + 1,
      updatedAt: now,
      state: "pending",
      attempts: 0,
      nextRetryAt: now,
      leaseOwner: undefined,
      leaseUntil: undefined,
      lastError: undefined,
    });
  } else {
    queueStore.add({
      operationId: operationId(),
      linkKey: link.linkKey,
      entityType,
      entityId,
      operation: "delete",
      payload: null,
      expectedCloudRevision: metadata?.cloudRevision ?? null,
      localRevision: nextRevision,
      generation: 1,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      nextRetryAt: now,
      state: "pending",
    } satisfies SyncQueueEntry);
  }
}
