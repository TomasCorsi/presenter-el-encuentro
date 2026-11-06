import { afterEach, describe, expect, it } from "bun:test";

import { createPreset } from "@/domain/presets/preset-rules";
import { createProject } from "@/domain/projects/project-rules";
import { createSong } from "@/domain/songs/song-rules";
import { createUuid } from "@/utils/create-id";

const originalCrypto = globalThis.crypto;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setCrypto(value: Partial<Crypto> | undefined): void {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => setCrypto(originalCrypto));

describe("createUuid", () => {
  it("uses native randomUUID when it is available", () => {
    const expected = "11111111-1111-4111-8111-111111111111";
    let calls = 0;
    setCrypto({
      randomUUID: () => {
        calls += 1;
        return expected;
      },
    });
    expect(createUuid()).toBe(expected);
    expect(calls).toBe(1);
  });

  it("falls back to getRandomValues and sets UUID v4 version and variant bits", () => {
    setCrypto({
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        new Uint8Array((array as ArrayBufferView).buffer).fill(0xff);
        return array;
      },
    });
    const value = createUuid();
    expect(value).toMatch(UUID_V4);
    expect(value).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("produces different IDs across fallback calls", () => {
    let seed = 0;
    setCrypto({
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        new Uint8Array((array as ArrayBufferView).buffer).fill(seed++);
        return array;
      },
    });
    const ids = new Set([createUuid(), createUuid(), createUuid()]);
    expect(ids.size).toBe(3);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it("does not fail when randomUUID is undefined", () => {
    setCrypto({
      randomUUID: undefined,
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => array,
    });
    expect(createUuid()).toMatch(UUID_V4);
  });

  it("is SSR-safe when Web Crypto is absent", () => {
    setCrypto(undefined);
    expect(() => createUuid()).not.toThrow();
    expect(createUuid()).toMatch(UUID_V4);
  });

  it("creates Project, Song and Preset through the shared fallback", () => {
    setCrypto({
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        originalCrypto.getRandomValues(array);
        return array;
      },
    });
    const dependencies = { createId: createUuid, now: () => "2026-11-06T00:00:00.000Z" };
    expect(createProject({ name: "Project" }, dependencies).id).toMatch(UUID_V4);
    expect(createSong({ title: "Song" }, dependencies).id).toMatch(UUID_V4);
    expect(createPreset({ name: "Preset" }, dependencies).id).toMatch(UUID_V4);
  });
});
