import type { SupabaseClient } from "@supabase/supabase-js";

import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import type { Preset } from "@/domain/presets/preset";
import { normalizeCloudError } from "./cloud-error";
import {
  presetFromCloudRow,
  presetToCloudRecord,
  projectFromCloudRow,
  projectToCloudRecord,
  songFromCloudRow,
  songToCloudRecord,
  type CloudWritableRecord,
} from "./cloud-mappers";

export interface CloudCrudRepository<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  put(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

interface CloudEntityAdapter<T> {
  table: "projects" | "songs" | "presets";
  toRecord(entity: T, workspaceId: string): CloudWritableRecord;
  fromRow(row: unknown): T;
}

export function createBoundCloudRepository<T>(
  client: SupabaseClient,
  workspaceId: string,
  adapter: CloudEntityAdapter<T>,
): CloudCrudRepository<T> {
  if (!workspaceId) throw new Error("Cloud repository requiere un workspace.");
  return {
    async list() {
      try {
        const { data, error } = await client
          .from(adapter.table)
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("entity_updated_at", { ascending: false });
        if (error) throw error;
        return (data ?? []).map(adapter.fromRow);
      } catch (error) {
        throw normalizeCloudError(error);
      }
    },
    async get(id) {
      try {
        const { data, error } = await client
          .from(adapter.table)
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data ? adapter.fromRow(data) : null;
      } catch (error) {
        throw normalizeCloudError(error);
      }
    },
    async put(entity) {
      try {
        const record = adapter.toRecord(entity, workspaceId);
        const { data, error } = await client
          .from(adapter.table)
          .upsert(record, { onConflict: "workspace_id,id" })
          .select("*")
          .single();
        if (error) throw error;
        return adapter.fromRow(data);
      } catch (error) {
        throw normalizeCloudError(error);
      }
    },
    async delete(id) {
      try {
        const { error } = await client
          .from(adapter.table)
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("id", id);
        if (error) throw error;
      } catch (error) {
        throw normalizeCloudError(error);
      }
    },
  };
}

export interface CloudRepositories {
  projects: CloudCrudRepository<Project>;
  songs: CloudCrudRepository<Song>;
  presets: CloudCrudRepository<Preset>;
}

export function createCloudRepositories(
  client: SupabaseClient,
  workspaceId: string,
): CloudRepositories {
  return {
    projects: createBoundCloudRepository(client, workspaceId, {
      table: "projects", toRecord: projectToCloudRecord, fromRow: projectFromCloudRow,
    }),
    songs: createBoundCloudRepository(client, workspaceId, {
      table: "songs", toRecord: songToCloudRecord, fromRow: songFromCloudRow,
    }),
    presets: createBoundCloudRepository(client, workspaceId, {
      table: "presets", toRecord: presetToCloudRecord, fromRow: presetFromCloudRow,
    }),
  };
}
