import { DEFAULT_PRESET_ID } from "@/domain/presets/preset";
import { createUuid } from "@/utils/create-id";
import {
  SYNC_ENTITY_TYPES,
  createSyncEntityKey,
  emptyCheckpoints,
  type SyncCloudRow,
  type SyncConflict,
  type SyncEntityMetadata,
  type SyncEntityType,
  type SyncLink,
  type SyncLinkAssessment,
  type SyncQueueEntry,
} from "@/domain/sync/sync";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
  type ApplicationMetaRecord,
} from "@/services/local-data/application-database";
import type { LocalDataChangeBus } from "@/services/local-data/local-data-change-bus";
import { ACTIVE_SYNC_LINK_META_KEY } from "./sync-journal";
import { queueResponseIsCurrent, syncFingerprint } from "./sync-rules";

const domainStore = (type: SyncEntityType): string =>
  type === "project"
    ? APPLICATION_STORES.projects
    : type === "song"
      ? APPLICATION_STORES.songs
      : APPLICATION_STORES.presets;
const rowRecord = (row: SyncCloudRow, localWorkspaceId: string): Record<string, unknown> => ({
  ...(structuredClone(row.record) as Record<string, unknown>),
  workspaceId: localWorkspaceId,
});

export class SyncLocalStore {
  constructor(
    private readonly factory: IDBFactory,
    private readonly changes: LocalDataChangeBus,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getActiveLink(): Promise<SyncLink | null> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction([
      APPLICATION_STORES.meta,
      APPLICATION_STORES.syncLinks,
    ]);
    const pointer = await idbRequest<ApplicationMetaRecord<string> | undefined>(
      transaction.objectStore(APPLICATION_STORES.meta).get(ACTIVE_SYNC_LINK_META_KEY),
    );
    if (typeof pointer?.value !== "string") return null;
    const link = await idbRequest<SyncLink | undefined>(
      transaction.objectStore(APPLICATION_STORES.syncLinks).get(pointer.value),
    );
    return link ?? null;
  }

  async listLocal(type: SyncEntityType): Promise<unknown[]> {
    const database = await openApplicationDatabase(this.factory);
    const values = await idbRequest<unknown[]>(
      database.transaction(domainStore(type)).objectStore(domainStore(type)).getAll(),
    );
    return type === "preset"
      ? values.filter((value) => (value as { id?: unknown }).id !== DEFAULT_PRESET_ID)
      : values;
  }

  async confirmLink(assessment: SyncLinkAssessment): Promise<void> {
    const prepared = await Promise.all(
      SYNC_ENTITY_TYPES.flatMap((type) => {
        const locals = assessment.local[type] as Array<{ id: string }>;
        const localById = new Map(locals.map((entity) => [entity.id, entity]));
        return assessment.cloud[type].map(async (cloud) => ({
          type,
          cloud,
          local: localById.get(cloud.entityId),
          cloudFingerprint: cloud.deletedAt ? null : await syncFingerprint(cloud.record),
          localFingerprint: localById.has(cloud.entityId)
            ? await syncFingerprint(localById.get(cloud.entityId))
            : null,
        }));
      }),
    );
    const database = await openApplicationDatabase(this.factory);
    const stores = [
      APPLICATION_STORES.projects,
      APPLICATION_STORES.songs,
      APPLICATION_STORES.presets,
      APPLICATION_STORES.meta,
      APPLICATION_STORES.syncLinks,
      APPLICATION_STORES.syncEntities,
      APPLICATION_STORES.syncQueue,
      APPLICATION_STORES.syncConflicts,
    ];
    const transaction = database.transaction(stores, "readwrite");
    const completed = idbTransactionDone(transaction);
    const timestamp = this.now();
    const link: SyncLink = {
      key: assessment.linkKey,
      linkKey: assessment.linkKey,
      userId: assessment.userId,
      cloudWorkspaceId: assessment.cloudWorkspaceId,
      localWorkspaceId: "local-workspace",
      state: "active",
      linkedAt: timestamp,
      checkpoints: emptyCheckpoints(),
    };
    transaction.objectStore(APPLICATION_STORES.syncLinks).put(link);
    transaction.objectStore(APPLICATION_STORES.meta).put({
      key: ACTIVE_SYNC_LINK_META_KEY,
      value: assessment.linkKey,
    } satisfies ApplicationMetaRecord<string>);

    const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const metadataStore = transaction.objectStore(APPLICATION_STORES.syncEntities);
    const conflictStore = transaction.objectStore(APPLICATION_STORES.syncConflicts);
    for (const type of SYNC_ENTITY_TYPES) {
      const local = assessment.local[type] as Array<{ id: string }>;
      const cloudIds = new Set(assessment.cloud[type].map((row) => row.entityId));
      for (const entity of local) {
        if (type === "preset" && entity.id === DEFAULT_PRESET_ID) continue;
        if (cloudIds.has(entity.id)) continue;
        const key = createSyncEntityKey(link.linkKey, type, entity.id);
        metadataStore.put({
          key,
          linkKey: link.linkKey,
          entityType: type,
          entityId: entity.id,
          localRevision: 1,
          syncedLocalRevision: 0,
          cloudRevision: null,
          lastSyncedFingerprint: null,
          lastSyncedAt: null,
        } satisfies SyncEntityMetadata);
        queueStore.add({
          operationId: createUuid(),
          linkKey: link.linkKey,
          entityType: type,
          entityId: entity.id,
          operation: "upsert",
          payload: structuredClone(entity),
          expectedCloudRevision: null,
          localRevision: 1,
          generation: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          attempts: 0,
          nextRetryAt: timestamp,
          state: "pending",
        } satisfies SyncQueueEntry);
      }
    }
    for (const item of prepared) {
      const { type, cloud, local, cloudFingerprint, localFingerprint } = item;
      const key = createSyncEntityKey(link.linkKey, type, cloud.entityId);
      if (local && (cloud.deletedAt || cloudFingerprint !== localFingerprint)) {
        conflictStore.put({
          key,
          linkKey: link.linkKey,
          entityType: type,
          entityId: cloud.entityId,
          kind: "initial",
          localSnapshot: structuredClone(local),
          cloud,
          detectedAt: timestamp,
        } satisfies SyncConflict);
        metadataStore.put({
          key,
          linkKey: link.linkKey,
          entityType: type,
          entityId: cloud.entityId,
          localRevision: 1,
          syncedLocalRevision: 0,
          cloudRevision: cloud.revision,
          lastSyncedFingerprint: null,
          lastSyncedAt: null,
        } satisfies SyncEntityMetadata);
        continue;
      }
      if (!local && !cloud.deletedAt) {
        transaction.objectStore(domainStore(type)).put(rowRecord(cloud, link.localWorkspaceId));
      }
      metadataStore.put({
        key,
        linkKey: link.linkKey,
        entityType: type,
        entityId: cloud.entityId,
        localRevision: local || !cloud.deletedAt ? 1 : 0,
        syncedLocalRevision: local || !cloud.deletedAt ? 1 : 0,
        cloudRevision: cloud.revision,
        lastSyncedFingerprint: cloudFingerprint,
        lastSyncedAt: timestamp,
      } satisfies SyncEntityMetadata);
      link.checkpoints[type] = Math.max(link.checkpoints[type], cloud.changeSeq);
    }
    transaction.objectStore(APPLICATION_STORES.syncLinks).put(link);
    await completed;
    for (const item of prepared) {
      if (!item.local && !item.cloud.deletedAt) {
        this.changes.publish({
          entityType: item.type,
          entityId: item.cloud.entityId,
          origin: "remote",
        });
      }
    }
  }

  async applyPullPage(link: SyncLink, type: SyncEntityType, rows: SyncCloudRow[]): Promise<void> {
    if (rows.length === 0) return;
    const fingerprints = new Map<string, string | null>();
    for (const row of rows)
      fingerprints.set(row.entityId, row.deletedAt ? null : await syncFingerprint(row.record));
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [
        domainStore(type),
        APPLICATION_STORES.meta,
        APPLICATION_STORES.syncLinks,
        APPLICATION_STORES.syncEntities,
        APPLICATION_STORES.syncQueue,
        APPLICATION_STORES.syncConflicts,
      ],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    const timestamp = this.now();
    const applied: string[] = [];
    let checkpoint = link.checkpoints[type];
    for (const row of rows) {
      const key = createSyncEntityKey(link.linkKey, type, row.entityId);
      const metadata = await idbRequest<SyncEntityMetadata | undefined>(
        transaction.objectStore(APPLICATION_STORES.syncEntities).get(key),
      );
      const queuedEntries = await idbRequest<SyncQueueEntry[]>(
        transaction
          .objectStore(APPLICATION_STORES.syncQueue)
          .index("by_link_entity")
          .getAll([link.linkKey, type, row.entityId]),
      );
      const queued = queuedEntries.find((entry) => entry.state !== "archived");
      const local = await idbRequest<Record<string, unknown> | undefined>(
        transaction.objectStore(domainStore(type)).get(row.entityId),
      );
      if (queued || (metadata && metadata.localRevision > metadata.syncedLocalRevision)) {
        transaction.objectStore(APPLICATION_STORES.syncConflicts).put({
          key,
          linkKey: link.linkKey,
          entityType: type,
          entityId: row.entityId,
          kind: row.deletedAt
            ? "remote-delete-local"
            : queued?.operation === "delete"
              ? "delete-update"
              : "update-update",
          localSnapshot: local ? structuredClone(local) : null,
          cloud: row,
          detectedAt: timestamp,
        } satisfies SyncConflict);
      } else {
        if (row.deletedAt) {
          transaction.objectStore(domainStore(type)).delete(row.entityId);
          if (type === "project") {
            const active = await idbRequest<ApplicationMetaRecord<string | null> | undefined>(
              transaction.objectStore(APPLICATION_STORES.meta).get("activeProjectId"),
            );
            if (active?.value === row.entityId) {
              transaction
                .objectStore(APPLICATION_STORES.meta)
                .put({ key: "activeProjectId", value: null });
            }
          }
        } else {
          transaction.objectStore(domainStore(type)).put(rowRecord(row, link.localWorkspaceId));
        }
        const localRevision = metadata?.localRevision ?? (row.deletedAt ? 0 : 1);
        transaction.objectStore(APPLICATION_STORES.syncEntities).put({
          key,
          linkKey: link.linkKey,
          entityType: type,
          entityId: row.entityId,
          localRevision,
          syncedLocalRevision: localRevision,
          cloudRevision: row.revision,
          lastSyncedFingerprint: fingerprints.get(row.entityId) ?? null,
          lastSyncedAt: timestamp,
        } satisfies SyncEntityMetadata);
        applied.push(row.entityId);
      }
      checkpoint = Math.max(checkpoint, row.changeSeq);
    }
    transaction.objectStore(APPLICATION_STORES.syncLinks).put({
      ...link,
      checkpoints: { ...link.checkpoints, [type]: checkpoint },
    } satisfies SyncLink);
    await completed;
    for (const entityId of applied)
      this.changes.publish({ entityType: type, entityId, origin: "remote" });
  }

  async claimNext(
    linkKey: string,
    owner: string,
    leaseMs = 30_000,
  ): Promise<SyncQueueEntry | null> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(APPLICATION_STORES.syncQueue, "readwrite");
    const completed = idbTransactionDone(transaction);
    const store = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const entries = await idbRequest<SyncQueueEntry[]>(store.index("by_link").getAll(linkKey));
    const now = this.now();
    const entry = entries
      .filter(
        (item) =>
          item.state === "pending" &&
          item.nextRetryAt <= now &&
          (!item.leaseUntil || item.leaseUntil <= now),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!entry) {
      await completed;
      return null;
    }
    const claimed = {
      ...entry,
      leaseOwner: owner,
      leaseUntil: new Date(Date.parse(now) + leaseMs).toISOString(),
    };
    store.put(claimed);
    await completed;
    return claimed;
  }

  async completePush(sent: SyncQueueEntry, row: SyncCloudRow): Promise<void> {
    const fingerprint = row.deletedAt ? null : await syncFingerprint(row.record);
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [APPLICATION_STORES.syncQueue, APPLICATION_STORES.syncEntities],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const current = await idbRequest<SyncQueueEntry | undefined>(queueStore.get(sent.operationId));
    const metadataStore = transaction.objectStore(APPLICATION_STORES.syncEntities);
    const key = createSyncEntityKey(sent.linkKey, sent.entityType, sent.entityId);
    const metadata = await idbRequest<SyncEntityMetadata | undefined>(metadataStore.get(key));
    if (metadata)
      metadataStore.put({
        ...metadata,
        cloudRevision: row.revision,
        syncedLocalRevision: queueResponseIsCurrent(current, sent)
          ? sent.localRevision
          : metadata.syncedLocalRevision,
        lastSyncedFingerprint: fingerprint,
        lastSyncedAt: this.now(),
      });
    if (queueResponseIsCurrent(current, sent)) queueStore.delete(sent.operationId);
    else if (current?.operationId === sent.operationId) {
      const { leaseOwner: _owner, leaseUntil: _until, ...next } = current;
      queueStore.put({ ...next, expectedCloudRevision: row.revision });
    }
    await completed;
  }

  async updateQueue(entry: SyncQueueEntry): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(APPLICATION_STORES.syncQueue, "readwrite");
    const completed = idbTransactionDone(transaction);
    transaction.objectStore(APPLICATION_STORES.syncQueue).put(entry);
    await completed;
  }

  async addConflict(conflict: SyncConflict, operationId?: string): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [APPLICATION_STORES.syncConflicts, APPLICATION_STORES.syncQueue],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    transaction.objectStore(APPLICATION_STORES.syncConflicts).put(conflict);
    if (operationId) transaction.objectStore(APPLICATION_STORES.syncQueue).delete(operationId);
    await completed;
  }

  async counts(linkKey: string): Promise<{ pending: number; conflicts: number; errors: number }> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction([
      APPLICATION_STORES.syncQueue,
      APPLICATION_STORES.syncConflicts,
    ]);
    const queue = await idbRequest<SyncQueueEntry[]>(
      transaction.objectStore(APPLICATION_STORES.syncQueue).index("by_link").getAll(linkKey),
    );
    const conflicts = await idbRequest<SyncConflict[]>(
      transaction.objectStore(APPLICATION_STORES.syncConflicts).index("by_link").getAll(linkKey),
    );
    return {
      pending: queue.filter((item) => item.state === "pending").length,
      errors: queue.filter((item) => item.state === "error").length,
      conflicts: conflicts.filter((item) => !item.archivedAt).length,
    };
  }

  async listConflicts(linkKey: string): Promise<SyncConflict[]> {
    const database = await openApplicationDatabase(this.factory);
    return idbRequest<SyncConflict[]>(
      database
        .transaction(APPLICATION_STORES.syncConflicts)
        .objectStore(APPLICATION_STORES.syncConflicts)
        .index("by_link")
        .getAll(linkKey),
    );
  }

  async nextRetryAt(linkKey: string): Promise<string | null> {
    const database = await openApplicationDatabase(this.factory);
    const entries = await idbRequest<SyncQueueEntry[]>(
      database
        .transaction(APPLICATION_STORES.syncQueue)
        .objectStore(APPLICATION_STORES.syncQueue)
        .index("by_link")
        .getAll(linkKey),
    );
    return (
      entries
        .filter((entry) => entry.state === "pending")
        .map((entry) => entry.nextRetryAt)
        .sort()[0] ?? null
    );
  }

  async markCycleComplete(link: SyncLink): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(APPLICATION_STORES.syncLinks, "readwrite");
    const completed = idbTransactionDone(transaction);
    const current = await idbRequest<SyncLink | undefined>(
      transaction.objectStore(APPLICATION_STORES.syncLinks).get(link.linkKey),
    );
    if (current)
      transaction
        .objectStore(APPLICATION_STORES.syncLinks)
        .put({ ...current, lastSyncAt: this.now() });
    await completed;
  }

  async pauseLink(link: SyncLink, reason: string): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [APPLICATION_STORES.syncLinks, APPLICATION_STORES.syncQueue],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    transaction
      .objectStore(APPLICATION_STORES.syncLinks)
      .put({ ...link, state: "paused", pausedReason: reason });
    const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const entries = await idbRequest<SyncQueueEntry[]>(
      queueStore.index("by_link").getAll(link.linkKey),
    );
    for (const entry of entries)
      if (entry.state === "pending") queueStore.put({ ...entry, state: "paused" });
    await completed;
  }

  async resumeLink(link: SyncLink): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [APPLICATION_STORES.syncLinks, APPLICATION_STORES.syncQueue],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    const { pausedReason: _reason, ...active } = link;
    transaction.objectStore(APPLICATION_STORES.syncLinks).put({ ...active, state: "active" });
    const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const entries = await idbRequest<SyncQueueEntry[]>(
      queueStore.index("by_link").getAll(link.linkKey),
    );
    for (const entry of entries) {
      if (entry.state !== "paused") continue;
      const { leaseOwner: _owner, leaseUntil: _until, ...clean } = entry;
      queueStore.put({ ...clean, state: "pending", nextRetryAt: this.now() });
    }
    await completed;
  }

  async retryErrors(linkKey: string): Promise<void> {
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(APPLICATION_STORES.syncQueue, "readwrite");
    const completed = idbTransactionDone(transaction);
    const store = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const entries = await idbRequest<SyncQueueEntry[]>(store.index("by_link").getAll(linkKey));
    const now = this.now();
    for (const entry of entries) {
      if (entry.state !== "error") continue;
      const { leaseOwner: _owner, leaseUntil: _until, lastError: _error, ...clean } = entry;
      store.put({ ...clean, state: "pending", attempts: 0, nextRetryAt: now });
    }
    await completed;
  }

  async resolveConflict(
    conflict: SyncConflict,
    resolution: "keep-local" | "use-cloud" | "duplicate-local",
  ): Promise<void> {
    const link = await this.getActiveLink();
    if (!link || link.linkKey !== conflict.linkKey)
      throw new Error("El vínculo del conflicto ya no está activo.");
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [
        domainStore(conflict.entityType),
        APPLICATION_STORES.syncEntities,
        APPLICATION_STORES.syncQueue,
        APPLICATION_STORES.syncConflicts,
      ],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    const timestamp = this.now();
    const queueStore = transaction.objectStore(APPLICATION_STORES.syncQueue);
    const metadataStore = transaction.objectStore(APPLICATION_STORES.syncEntities);
    const entityStore = transaction.objectStore(domainStore(conflict.entityType));
    const metadata = await idbRequest<SyncEntityMetadata | undefined>(
      metadataStore.get(conflict.key),
    );
    const queuedEntries = await idbRequest<SyncQueueEntry[]>(
      queueStore
        .index("by_link_entity")
        .getAll([conflict.linkKey, conflict.entityType, conflict.entityId]),
    );
    const queued = queuedEntries.find((entry) => entry.state !== "archived");

    if (resolution === "keep-local") {
      const operation = conflict.localSnapshot ? "upsert" : "delete";
      const entry: SyncQueueEntry = {
        operationId: queued?.operationId ?? createUuid(),
        linkKey: conflict.linkKey,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        operation,
        payload: conflict.localSnapshot ? structuredClone(conflict.localSnapshot) : null,
        expectedCloudRevision: conflict.cloud?.revision ?? metadata?.cloudRevision ?? null,
        localRevision: metadata?.localRevision ?? 1,
        generation: (queued?.generation ?? 0) + 1,
        createdAt: queued?.createdAt ?? timestamp,
        updatedAt: timestamp,
        attempts: 0,
        nextRetryAt: timestamp,
        state: "pending",
      };
      queueStore.put(entry);
    } else {
      if (resolution === "duplicate-local" && conflict.localSnapshot) {
        const source = structuredClone(conflict.localSnapshot) as Record<string, unknown>;
        const copyId = createUuid();
        const nameKey = conflict.entityType === "song" ? "title" : "name";
        const copy = {
          ...source,
          id: copyId,
          [nameKey]: `${String(source[nameKey] ?? "Copia")} (copia local)`,
          updatedAt: timestamp,
          createdAt: timestamp,
        };
        entityStore.put(copy);
        const copyKey = createSyncEntityKey(link.linkKey, conflict.entityType, copyId);
        metadataStore.put({
          key: copyKey,
          linkKey: link.linkKey,
          entityType: conflict.entityType,
          entityId: copyId,
          localRevision: 1,
          syncedLocalRevision: 0,
          cloudRevision: null,
          lastSyncedFingerprint: null,
          lastSyncedAt: null,
        } satisfies SyncEntityMetadata);
        queueStore.add({
          operationId: createUuid(),
          linkKey: link.linkKey,
          entityType: conflict.entityType,
          entityId: copyId,
          operation: "upsert",
          payload: copy,
          expectedCloudRevision: null,
          localRevision: 1,
          generation: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          attempts: 0,
          nextRetryAt: timestamp,
          state: "pending",
        } satisfies SyncQueueEntry);
      }
      if (conflict.cloud?.deletedAt || !conflict.cloud) entityStore.delete(conflict.entityId);
      else entityStore.put(rowRecord(conflict.cloud, link.localWorkspaceId));
      if (queued) queueStore.delete(queued.operationId);
      if (conflict.cloud)
        metadataStore.put({
          key: conflict.key,
          linkKey: link.linkKey,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          localRevision: metadata?.localRevision ?? 1,
          syncedLocalRevision: metadata?.localRevision ?? 1,
          cloudRevision: conflict.cloud.revision,
          lastSyncedFingerprint: null,
          lastSyncedAt: timestamp,
        } satisfies SyncEntityMetadata);
    }
    transaction.objectStore(APPLICATION_STORES.syncConflicts).delete(conflict.key);
    await completed;
    this.changes.publish({
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      origin: "remote",
    });
  }

  async archiveActiveLink(): Promise<void> {
    const link = await this.getActiveLink();
    if (!link) return;
    const database = await openApplicationDatabase(this.factory);
    const transaction = database.transaction(
      [
        APPLICATION_STORES.meta,
        APPLICATION_STORES.syncLinks,
        APPLICATION_STORES.syncEntities,
        APPLICATION_STORES.syncQueue,
        APPLICATION_STORES.syncConflicts,
      ],
      "readwrite",
    );
    const completed = idbTransactionDone(transaction);
    const archivedAt = this.now();
    const linkStore = transaction.objectStore(APPLICATION_STORES.syncLinks);
    linkStore.delete(link.key);
    linkStore.put({
      ...link,
      key: `${link.linkKey}#archived:${archivedAt}`,
      state: "archived",
      archivedAt,
    });
    transaction.objectStore(APPLICATION_STORES.meta).delete(ACTIVE_SYNC_LINK_META_KEY);
    for (const name of [
      APPLICATION_STORES.syncEntities,
      APPLICATION_STORES.syncQueue,
      APPLICATION_STORES.syncConflicts,
    ]) {
      const store = transaction.objectStore(name);
      const records = await idbRequest<Array<Record<string, unknown>>>(
        store.index("by_link").getAll(link.linkKey),
      );
      for (const record of records) {
        if (record["archivedAt"]) continue;
        if (name === APPLICATION_STORES.syncEntities || name === APPLICATION_STORES.syncConflicts) {
          store.delete(record["key"] as IDBValidKey);
          store.put({
            ...record,
            key: `${String(record["key"])}#archived:${archivedAt}`,
            archivedAt,
          });
        } else {
          store.put({ ...record, state: "archived", archivedAt });
        }
      }
    }
    await completed;
  }
}
