import { describe, expect, it } from "bun:test";

describe("Fase 13 cloud boundary", () => {
  it("mantiene CloudProvider sólo en App Shell y fuera de Outputs", async () => {
    const app = await Bun.file("src/routes/_app.tsx").text();
    const main = await Bun.file("src/routes/output.main.tsx").text();
    const stage = await Bun.file("src/routes/output.stage.tsx").text();
    const stream = await Bun.file("src/routes/output.stream.tsx").text();
    expect(app).toContain("<CloudProvider>");
    for (const source of [main, stage, stream]) expect(source).not.toContain("CloudProvider");
  });

  it("no conecta repositories cloud con providers operativos", async () => {
    for (const path of [
      "src/features/projects/projects-context.tsx",
      "src/features/songs/songs-context.tsx",
      "src/features/presets/presets-context.tsx",
      "src/features/media/media-context.tsx",
      "src/routes/_app.live.tsx",
    ]) {
      expect(await Bun.file(path).text()).not.toContain("services/cloud");
    }
  });

  it("Settings no ofrece acciones de transferencia o sync", async () => {
    const source = await Bun.file("src/features/cloud/components/cloud-account-settings.tsx").text();
    for (const forbidden of [">Sincronizar<", ">Subir<", ">Descargar<", ">Importar<", ">Publicar<", ">Combinar<"]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain("Tus datos locales todavía no están vinculados ni sincronizados.");
  });

  it("SQL crea sólo entidades cloud aprobadas y aplica RLS", async () => {
    const sql = await Bun.file("supabase/migrations/202611030001_phase13_cloud_foundation.sql").text();
    for (const table of ["profiles", "workspaces", "workspace_members", "projects", "songs", "presets"]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).not.toContain("create table public.media");
    expect(sql).not.toContain("storage.buckets");
    expect(sql).not.toContain("deleted_at");
    expect(sql).toContain("ensure_personal_workspace");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
  });
});
