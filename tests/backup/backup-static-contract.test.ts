import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("backup architecture boundaries", () => {
  it("mounts BackupProvider only in the App Shell", () => {
    const shell = read("src/routes/_app.tsx");
    expect(shell).toContain("<BackupProvider>");
    for (const route of [
      "src/routes/output.main.tsx",
      "src/routes/output.stage.tsx",
      "src/routes/output.stream.tsx",
    ]) {
      expect(read(route)).not.toContain("BackupProvider");
    }
  });

  it("does not couple Backup to Presentation, LiveSession or OutputSnapshot", () => {
    const files = [
      "src/services/backup/backup-exporter.ts",
      "src/services/backup/backup-inspector.ts",
      "src/services/backup/backup-restorer.ts",
    ]
      .map(read)
      .join("\n");
    expect(files).not.toContain("PresentationStore");
    expect(files).not.toContain("LiveSession");
    expect(files).not.toContain("OutputSnapshot");
  });

  it("keeps Sync state excluded and reset on restore", () => {
    const snapshot = read("src/services/backup/local-backup-snapshot.ts");
    const restore = read("src/services/backup/backup-restorer.ts");
    expect(snapshot).toContain("syncSummary");
    expect(restore).toContain("sync.reassessment-required");
    expect(restore).toContain("[APPLICATION_STORES.syncQueue]: []");
  });

  it("keeps backup/network paths out of Service Worker caching", () => {
    const sw = read("src/pwa/sw.ts");
    expect(sw).toContain("CHECK_MAINTENANCE_SAFETY");
    expect(sw).toContain("NetworkOnly");
    expect(sw).not.toContain("BackgroundSyncPlugin");
  });
});
