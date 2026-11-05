import { describe, expect, it } from "bun:test";

describe("sync architecture contract", () => {
  it("keeps operational features away from cloud and sync gateways", async () => {
    for (const path of [
      "src/features/projects",
      "src/features/songs",
      "src/features/presets",
      "src/features/live",
      "src/features/presentation",
    ]) {
      const files = await Array.fromAsync(
        new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: path, absolute: true }),
      );
      for (const file of files) {
        const source = await Bun.file(file).text();
        expect(source).not.toContain("services/sync/sync-cloud-gateway");
        expect(source).not.toContain("@supabase/supabase-js");
      }
    }
    for (const file of [
      "src/routes/_app.live.tsx",
      "src/routes/output.main.tsx",
      "src/routes/output.stage.tsx",
      "src/routes/output.stream.tsx",
    ]) {
      const source = await Bun.file(file).text();
      expect(source).not.toContain("services/sync/sync-cloud-gateway");
      expect(source).not.toContain("@supabase/supabase-js");
    }
  });
  it("keeps the Supabase client hook scoped to SyncProvider", async () => {
    const cloud = await Bun.file("src/features/cloud/cloud-context.tsx").text();
    const sync = await Bun.file("src/features/sync/sync-context.tsx").text();
    expect(cloud).toContain("export function useCloudSyncClient");
    expect(sync).toContain("useCloudSyncClient");
    for (const file of [
      "src/routes/_app.tsx",
      "src/features/projects/projects-context.tsx",
      "src/features/songs/songs-context.tsx",
      "src/features/presets/presets-context.tsx",
    ]) {
      expect(await Bun.file(file).text()).not.toContain("useCloudSyncClient");
    }
  });
});
