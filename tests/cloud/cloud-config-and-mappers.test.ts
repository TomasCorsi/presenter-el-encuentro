import { describe, expect, it } from "bun:test";

import { DEFAULT_PRESET_STYLE, type Preset } from "@/domain/presets/preset";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import { resolveCloudConfiguration } from "@/services/cloud/cloud-config";
import { CloudRepositoryError } from "@/services/cloud/cloud-error";
import {
  presetFromCloudRow,
  presetToCloudRecord,
  projectFromCloudRow,
  projectToCloudRecord,
  songFromCloudRow,
  songToCloudRecord,
} from "@/services/cloud/cloud-mappers";

const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-02T00:00:00.000Z";
const cloudWorkspace = "00000000-0000-4000-8000-000000000001";

describe("cloud configuration", () => {
  it("permite ausencia total sin afectar la app local", () => {
    expect(resolveCloudConfiguration({})).toEqual({ state: "unconfigured" });
  });

  it("acepta URL segura y publishable key", () => {
    expect(resolveCloudConfiguration({
      VITE_SUPABASE_URL: "https://church.supabase.co/",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    })).toEqual({
      state: "configured",
      url: "https://church.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("rechaza configuración parcial e HTTP remoto", () => {
    expect(resolveCloudConfiguration({ VITE_SUPABASE_URL: "https://church.supabase.co" }).state).toBe("invalid");
    expect(resolveCloudConfiguration({
      VITE_SUPABASE_URL: "http://church.example",
      VITE_SUPABASE_PUBLISHABLE_KEY: "key",
    }).state).toBe("invalid");
    expect(resolveCloudConfiguration({
      VITE_SUPABASE_URL: "https://church.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden",
    }).state).toBe("invalid");
  });
});

describe("cloud entity mappers", () => {
  it("roundtrip Project sin guardar el workspace local en payload", () => {
    const project: Project = {
      id: "project-1", workspaceId: "local-workspace", name: "Culto", rundown: [], createdAt, updatedAt,
    };
    const record = projectToCloudRecord(project, cloudWorkspace);
    expect(record.workspace_id).toBe(cloudWorkspace);
    expect(JSON.stringify(record.payload)).not.toContain("local-workspace");
    expect(projectFromCloudRow(record)).toEqual({ ...project, workspaceId: cloudWorkspace });
  });

  it("roundtrip Song y Preset con payload schemaVersion 1", () => {
    const song: Song = {
      id: "song-1", workspaceId: "local-workspace", title: "Song", author: "Author",
      sections: [{ id: "section-1", type: "verse", label: "Verse 1", content: "Text", order: 0 }],
      createdAt, updatedAt,
    };
    const preset: Preset = {
      id: "preset-1", workspaceId: "local-workspace", name: "Preset",
      style: DEFAULT_PRESET_STYLE, createdAt, updatedAt,
    };
    const songRecord = songToCloudRecord(song, cloudWorkspace);
    const presetRecord = presetToCloudRecord(preset, cloudWorkspace);
    expect(songRecord.payload).toMatchObject({ schemaVersion: 1 });
    expect(presetRecord.payload).toMatchObject({ schemaVersion: 1 });
    expect(songFromCloudRow(songRecord)).toEqual({ ...song, workspaceId: cloudWorkspace });
    expect(presetFromCloudRow(presetRecord)).toEqual({ ...preset, workspaceId: cloudWorkspace });
  });

  it("rechaza límites y payload mayor a 1 MiB", () => {
    const huge: Song = {
      id: "song-large", workspaceId: "local-workspace", title: "Song",
      sections: [{ id: "section", type: "verse", label: "Verse", content: "x".repeat(1024 * 1024 + 1), order: 0 }],
      createdAt, updatedAt,
    };
    expect(() => songToCloudRecord(huge, cloudWorkspace)).toThrow(CloudRepositoryError);
    expect(() => projectToCloudRecord({ id: "p", workspaceId: "local", name: "x".repeat(101), rundown: [], createdAt, updatedAt }, cloudWorkspace)).toThrow();
  });
});
