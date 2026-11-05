export const SYNC_ENTITY_TYPES = ["project", "song", "preset"] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
export type SyncOperation = "upsert" | "delete";
export type SyncStatus = "disabled" | "idle" | "syncing" | "offline" | "error" | "conflict";
export type SyncLinkState = "active" | "paused" | "archived";
export type SyncQueueState = "pending" | "paused" | "error" | "archived";
export type SyncConflictKind =
  "initial" | "update-update" | "delete-update" | "update-tombstone" | "remote-delete-local";

export interface SyncCheckpoints {
  project: number;
  song: number;
  preset: number;
}
export interface SyncLink {
  key: string;
  linkKey: string;
  userId: string;
  cloudWorkspaceId: string;
  localWorkspaceId: string;
  state: SyncLinkState;
  linkedAt: string;
  archivedAt?: string;
  pausedReason?: string;
  lastSyncAt?: string;
  checkpoints: SyncCheckpoints;
}
export interface SyncEntityMetadata {
  key: string;
  linkKey: string;
  entityType: SyncEntityType;
  entityId: string;
  localRevision: number;
  syncedLocalRevision: number;
  cloudRevision: number | null;
  lastSyncedFingerprint: string | null;
  lastSyncedAt: string | null;
  archivedAt?: string;
}
export interface SyncQueueEntry {
  operationId: string;
  linkKey: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: unknown | null;
  expectedCloudRevision: number | null;
  localRevision: number;
  generation: number;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextRetryAt: string;
  state: SyncQueueState;
  leaseOwner?: string;
  leaseUntil?: string;
  lastError?: string;
  archivedAt?: string;
}
export interface SyncCloudRow {
  entityType: SyncEntityType;
  entityId: string;
  record: unknown;
  revision: number;
  changeSeq: number;
  operationId: string | null;
  deletedAt: string | null;
}
export interface SyncConflict {
  key: string;
  linkKey: string;
  entityType: SyncEntityType;
  entityId: string;
  kind: SyncConflictKind;
  localSnapshot: unknown | null;
  cloud: SyncCloudRow | null;
  detectedAt: string;
  archivedAt?: string;
}
export interface SyncLinkAssessmentCounts {
  local: number;
  cloud: number;
  onlyLocal: number;
  onlyCloud: number;
  identical: number;
  collisions: number;
  tombstones: number;
}
export interface SyncLinkAssessment {
  userId: string;
  cloudWorkspaceId: string;
  linkKey: string;
  token: string;
  counts: Record<SyncEntityType, SyncLinkAssessmentCounts>;
  local: Record<SyncEntityType, unknown[]>;
  cloud: Record<SyncEntityType, SyncCloudRow[]>;
  collisions: Array<{ entityType: SyncEntityType; entityId: string }>;
}
export const emptyCheckpoints = (): SyncCheckpoints => ({ project: 0, song: 0, preset: 0 });
export const createLinkKey = (userId: string, cloudWorkspaceId: string): string =>
  `${userId}:${cloudWorkspaceId}`;
export const createSyncEntityKey = (linkKey: string, type: SyncEntityType, id: string): string =>
  `${linkKey}|${type}|${id}`;
