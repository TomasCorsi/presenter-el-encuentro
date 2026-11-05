import { describe, expect, it } from "bun:test";
import {
  canAutoRetry,
  canonicalSyncJson,
  queueResponseIsCurrent,
  retryDelayMilliseconds,
} from "@/services/sync/sync-rules";
import type { SyncQueueEntry } from "@/domain/sync/sync";

const entry = { operationId: "op", generation: 2 } as SyncQueueEntry;

describe("sync rules", () => {
  it("canonicalizes keys and excludes workspace/sync metadata", () => {
    expect(
      canonicalSyncJson({ z: 1, workspaceId: "local", a: { y: 2, x: 1 }, sync_revision: 9 }),
    ).toBe('{"a":{"x":1,"y":2},"z":1}');
  });
  it("implements bounded exponential backoff with jitter and Retry-After", () => {
    expect(retryDelayMilliseconds(1, () => 0)).toBe(4_000);
    expect(retryDelayMilliseconds(2, () => 0.5)).toBe(10_000);
    expect(retryDelayMilliseconds(20, () => 1)).toBe(1_080_000);
    expect(retryDelayMilliseconds(5, () => 0, 42_000)).toBe(42_000);
    expect(canAutoRetry(9)).toBe(true);
    expect(canAutoRetry(10)).toBe(false);
  });
  it("only accepts the exact in-flight generation", () => {
    expect(queueResponseIsCurrent(entry, { operationId: "op", generation: 2 })).toBe(true);
    expect(queueResponseIsCurrent(entry, { operationId: "op", generation: 1 })).toBe(false);
    expect(queueResponseIsCurrent(entry, { operationId: "other", generation: 2 })).toBe(false);
  });
});
