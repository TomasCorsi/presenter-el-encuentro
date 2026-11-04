import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Project } from "@/domain/projects/project";
import { createCloudRepositories } from "@/services/cloud/cloud-repository";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const project: Project = {
  id: "project-1",
  workspaceId: "local-workspace",
  name: "Culto",
  rundown: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function fakeClient() {
  const calls: Array<[string, unknown]> = [];
  const row = {
    workspace_id: workspaceId,
    id: project.id,
    name: project.name,
    payload: { schemaVersion: 1, rundown: [] },
    entity_created_at: project.createdAt,
    entity_updated_at: project.updatedAt,
  };
  const query = {
    eq(column: string, value: unknown) { calls.push([`eq:${column}`, value]); return query; },
    order(column: string) { calls.push(["order", column]); return Promise.resolve({ data: [row], error: null }); },
    maybeSingle() { return Promise.resolve({ data: row, error: null }); },
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: null, error: null }).then(resolve); },
  };
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return {
        select() { return query; },
        delete() { return query; },
        upsert(record: unknown, options: unknown) {
          calls.push(["upsert", { record, options }]);
          return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("bound cloud repositories", () => {
  it("liga todas las consultas al workspace de construcción", async () => {
    const { client, calls } = fakeClient();
    const repository = createCloudRepositories(client, workspaceId).projects;
    await repository.list();
    await repository.get(project.id);
    await repository.put(project);
    await repository.delete(project.id);
    expect(calls.filter(([name]) => name === "eq:workspace_id").map(([, value]) => value)).toEqual([
      workspaceId, workspaceId, workspaceId,
    ]);
    expect(calls.find(([name]) => name === "upsert")?.[1]).toMatchObject({
      options: { onConflict: "workspace_id,id" },
      record: { workspace_id: workspaceId },
    });
  });
});
