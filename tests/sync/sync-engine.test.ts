import { describe, expect, it } from "bun:test";
import { SyncEngine } from "@/services/sync/sync-engine";
import type { SyncCloudGateway } from "@/services/sync/sync-cloud-gateway";
import type { SyncLocalStore } from "@/services/sync/sync-local-store";
import type { SyncLink, SyncQueueEntry } from "@/domain/sync/sync";

const link: SyncLink = {
  key: "u:w",
  linkKey: "u:w",
  userId: "u",
  cloudWorkspaceId: "w",
  localWorkspaceId: "local-workspace",
  state: "active",
  linkedAt: "2026-01-01T00:00:00Z",
  checkpoints: { project: 0, song: 0, preset: 0 },
};
const entry: SyncQueueEntry = {
  operationId: "00000000-0000-4000-8000-000000000001",
  linkKey: "u:w",
  entityType: "song",
  entityId: "s",
  operation: "upsert",
  payload: { id: "s" },
  expectedCloudRevision: null,
  localRevision: 1,
  generation: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  attempts: 0,
  nextRetryAt: "2026-01-01T00:00:00Z",
  state: "pending",
};

describe("SyncEngine", () => {
  it("runs pull → flush → final pull → lastSyncAt and accepts idempotent lost responses", async () => {
    const calls: string[] = [];
    let claim = true;
    const local = {
      getActiveLink: async () => link,
      applyPullPage: async () => {
        calls.push("apply-pull");
      },
      claimNext: async () => {
        calls.push("claim");
        if (!claim) return null;
        claim = false;
        return entry;
      },
      completePush: async () => {
        calls.push("complete-push");
      },
      addConflict: async () => {
        calls.push("conflict");
      },
      pauseLink: async () => {
        calls.push("pause");
      },
      updateQueue: async () => {
        calls.push("retry");
      },
      markCycleComplete: async () => {
        calls.push("last-sync");
      },
    } as unknown as SyncLocalStore;
    const gateway = {
      pull: async (_workspace: string, type: string) => {
        calls.push(`pull:${type}`);
        return [];
      },
      apply: async () => {
        calls.push("push");
        return {
          outcome: "idempotent" as const,
          row: {
            entityType: "song" as const,
            entityId: "s",
            record: { id: "s" },
            revision: 1,
            changeSeq: 1,
            operationId: entry.operationId,
            deletedAt: null,
          },
        };
      },
    } as unknown as SyncCloudGateway;
    await new SyncEngine(local, gateway, () => true).run();
    expect(calls).toEqual([
      "pull:project",
      "pull:song",
      "pull:preset",
      "claim",
      "push",
      "complete-push",
      "claim",
      "pull:project",
      "pull:song",
      "pull:preset",
      "last-sync",
    ]);
  });

  it("does not touch attempts or cloud while offline", async () => {
    const calls: string[] = [];
    const local = {
      getActiveLink: async () => link,
      updateQueue: async () => calls.push("update"),
    } as unknown as SyncLocalStore;
    const gateway = {
      pull: async () => {
        calls.push("pull");
        return [];
      },
    } as unknown as SyncCloudGateway;
    await new SyncEngine(local, gateway, () => false).run();
    expect(calls).toEqual([]);
  });

  it("quarantines a revision mismatch without retrying", async () => {
    const calls: string[] = [];
    let claim = true;
    const local = {
      getActiveLink: async () => link,
      applyPullPage: async () => undefined,
      claimNext: async () => (claim ? ((claim = false), entry) : null),
      addConflict: async () => calls.push("conflict"),
      markCycleComplete: async () => calls.push("last-sync"),
    } as unknown as SyncLocalStore;
    const gateway = {
      pull: async () => [],
      apply: async () => ({
        outcome: "conflict" as const,
        row: {
          entityType: "song" as const,
          entityId: "s",
          record: { id: "s" },
          revision: 2,
          changeSeq: 2,
          operationId: null,
          deletedAt: null,
        },
      }),
    } as unknown as SyncCloudGateway;
    await new SyncEngine(local, gateway, () => true).run();
    expect(calls).toEqual(["conflict", "last-sync"]);
  });
});
