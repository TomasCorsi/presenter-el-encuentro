import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRESET_ID } from "@/domain/presets/preset";
import {
  SYNC_ENTITY_TYPES,
  createLinkKey,
  type SyncCloudRow,
  type SyncEntityType,
  type SyncLinkAssessment,
  type SyncLinkAssessmentCounts,
  type SyncQueueEntry,
} from "@/domain/sync/sync";
import { normalizeCloudError } from "@/services/cloud/cloud-error";
import {
  presetFromCloudRow,
  presetToCloudRecord,
  projectFromCloudRow,
  projectToCloudRecord,
  songFromCloudRow,
  songToCloudRecord,
} from "@/services/cloud/cloud-mappers";
import { syncFingerprint } from "./sync-rules";

export interface SyncApplyResult {
  outcome: "applied" | "idempotent" | "conflict";
  row: SyncCloudRow | null;
}

export interface SyncCloudGateway {
  assess(input: {
    userId: string;
    cloudWorkspaceId: string;
    local: Record<SyncEntityType, unknown[]>;
  }): Promise<SyncLinkAssessment>;
  assessmentToken(cloudWorkspaceId: string): Promise<string>;
  pull(cloudWorkspaceId: string, type: SyncEntityType, after: number): Promise<SyncCloudRow[]>;
  apply(cloudWorkspaceId: string, entry: SyncQueueEntry): Promise<SyncApplyResult>;
}

const tableFor = (type: SyncEntityType): "projects" | "songs" | "presets" =>
  type === "project" ? "projects" : type === "song" ? "songs" : "presets";
const fromRow = (type: SyncEntityType, row: unknown): unknown =>
  type === "project"
    ? projectFromCloudRow(row)
    : type === "song"
      ? songFromCloudRow(row)
      : presetFromCloudRow(row);

function cloudRow(type: SyncEntityType, value: unknown): SyncCloudRow {
  const row = value as Record<string, unknown>;
  return {
    entityType: type,
    entityId: String(row["id"]),
    record: fromRow(type, value),
    revision: Number(row["sync_revision"]),
    changeSeq: Number(row["sync_change_seq"]),
    operationId: typeof row["last_operation_id"] === "string" ? row["last_operation_id"] : null,
    deletedAt: typeof row["deleted_at"] === "string" ? row["deleted_at"] : null,
  };
}

export function createSupabaseSyncGateway(client: SupabaseClient): SyncCloudGateway {
  const pull = async (
    workspaceId: string,
    type: SyncEntityType,
    after: number,
  ): Promise<SyncCloudRow[]> => {
    try {
      const { data, error } = await client
        .from(tableFor(type))
        .select("*")
        .eq("workspace_id", workspaceId)
        .gt("sync_change_seq", after)
        .order("sync_change_seq", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row) => cloudRow(type, row));
    } catch (error) {
      throw normalizeCloudError(error);
    }
  };

  const allRows = async (workspaceId: string, type: SyncEntityType): Promise<SyncCloudRow[]> => {
    const rows: SyncCloudRow[] = [];
    let cursor = 0;
    for (;;) {
      const page = await pull(workspaceId, type, cursor);
      rows.push(...page);
      if (page.length < 200) return rows;
      cursor = page.at(-1)?.changeSeq ?? cursor;
    }
  };

  const assessmentToken = async (workspaceId: string): Promise<string> => {
    const maxima: Record<SyncEntityType, number> = { project: 0, song: 0, preset: 0 };
    for (const type of SYNC_ENTITY_TYPES) {
      try {
        const { data, error } = await client
          .from(tableFor(type))
          .select("sync_change_seq")
          .eq("workspace_id", workspaceId)
          .order("sync_change_seq", { ascending: false })
          .limit(1);
        if (error) throw error;
        maxima[type] = Number(data?.[0]?.sync_change_seq ?? 0);
      } catch (error) {
        throw normalizeCloudError(error);
      }
    }
    return syncFingerprint(maxima);
  };

  return {
    assessmentToken,
    pull,
    async assess({ userId, cloudWorkspaceId, local }) {
      const cloud = { project: [], song: [], preset: [] } as Record<SyncEntityType, SyncCloudRow[]>;
      for (const type of SYNC_ENTITY_TYPES) cloud[type] = await allRows(cloudWorkspaceId, type);
      const token = await assessmentToken(cloudWorkspaceId);
      const collisions: SyncLinkAssessment["collisions"] = [];
      const counts = {} as Record<SyncEntityType, SyncLinkAssessmentCounts>;
      for (const type of SYNC_ENTITY_TYPES) {
        const localEntities = (local[type] as Array<{ id: string }>).filter(
          (entity) => !(type === "preset" && entity.id === DEFAULT_PRESET_ID),
        );
        const localMap = new Map(localEntities.map((entity) => [entity.id, entity]));
        const cloudMap = new Map(cloud[type].map((row) => [row.entityId, row]));
        let identical = 0;
        let collisionCount = 0;
        for (const entity of localEntities) {
          const row = cloudMap.get(entity.id);
          if (!row) continue;
          if (
            !row.deletedAt &&
            (await syncFingerprint(entity)) === (await syncFingerprint(row.record))
          )
            identical += 1;
          else {
            collisionCount += 1;
            collisions.push({ entityType: type, entityId: entity.id });
          }
        }
        counts[type] = {
          local: localEntities.length,
          cloud: cloud[type].filter((row) => !row.deletedAt).length,
          onlyLocal: localEntities.filter((entity) => !cloudMap.has(entity.id)).length,
          onlyCloud: cloud[type].filter((row) => !row.deletedAt && !localMap.has(row.entityId))
            .length,
          identical,
          collisions: collisionCount,
          tombstones: cloud[type].filter((row) => Boolean(row.deletedAt)).length,
        };
      }
      return {
        userId,
        cloudWorkspaceId,
        linkKey: createLinkKey(userId, cloudWorkspaceId),
        token,
        counts,
        local,
        cloud,
        collisions,
      };
    },
    async apply(workspaceId, entry) {
      if (entry.entityType === "preset" && entry.entityId === DEFAULT_PRESET_ID) {
        throw normalizeCloudError({ code: "23514", message: "preset-default no se sincroniza" });
      }
      try {
        const record =
          entry.payload === null
            ? null
            : entry.entityType === "project"
              ? projectToCloudRecord(
                  entry.payload as Parameters<typeof projectToCloudRecord>[0],
                  workspaceId,
                )
              : entry.entityType === "song"
                ? songToCloudRecord(
                    entry.payload as Parameters<typeof songToCloudRecord>[0],
                    workspaceId,
                  )
                : presetToCloudRecord(
                    entry.payload as Parameters<typeof presetToCloudRecord>[0],
                    workspaceId,
                  );
        const { data, error } = await client.rpc("apply_sync_change", {
          target_workspace_id: workspaceId,
          target_entity_type: entry.entityType,
          target_entity_id: entry.entityId,
          target_operation: entry.operation,
          target_operation_id: entry.operationId,
          expected_revision: entry.expectedCloudRevision,
          target_record: record,
        });
        if (error) throw error;
        const result = data as { outcome?: unknown; row?: unknown };
        if (
          result.outcome !== "applied" &&
          result.outcome !== "idempotent" &&
          result.outcome !== "conflict"
        ) {
          throw new Error("Supabase devolvió un resultado de sync inválido.");
        }
        return {
          outcome: result.outcome,
          row: result.row ? cloudRow(entry.entityType, result.row) : null,
        };
      } catch (error) {
        throw normalizeCloudError(error);
      }
    },
  };
}
