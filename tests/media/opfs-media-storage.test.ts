import { describe, expect, it } from "bun:test";
import { WritableStream as NativeWritableStream } from "node:stream/web";

import { createOpfsMediaStorage } from "@/services/media/opfs-media-storage";

interface FakeFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
  getFile(): Promise<File>;
  move(name: string): Promise<void>;
}

function fakeOpfs() {
  const files = new Map<string, Blob>();
  let failWrite = false;

  const directory = {
    async getDirectoryHandle() {
      return directory;
    },
    async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
      if (!options?.create && !files.has(name)) throw new DOMException("missing", "NotFoundError");
      let currentName = name;
      return {
        async createWritable() {
          const chunks: Uint8Array[] = [];
          return new NativeWritableStream<Uint8Array>({
            write(chunk) {
              if (failWrite) throw new Error("write failed");
              chunks.push(chunk);
            },
            close() {
              files.set(currentName, new Blob(chunks));
            },
          });
        },
        async getFile() {
          const blob = files.get(currentName);
          if (!blob) throw new DOMException("missing", "NotFoundError");
          return new File([blob], currentName);
        },
        async move(nextName: string) {
          const blob = files.get(currentName);
          if (!blob) throw new DOMException("missing", "NotFoundError");
          files.delete(currentName);
          files.set(nextName, blob);
          currentName = nextName;
        },
      };
    },
    async removeEntry(name: string) {
      if (!files.delete(name)) throw new DOMException("missing", "NotFoundError");
    },
  };

  return {
    files,
    directory,
    setFailWrite(value: boolean) {
      failWrite = value;
    },
  };
}

describe("OPFS MediaFileStorage", () => {
  it("escribe por temporal, mueve, lee y elimina", async () => {
    const fake = fakeOpfs();
    const storage = createOpfsMediaStorage(async () => fake.directory, true);
    await storage.save("asset", new Blob([new Uint8Array([1, 2, 3])]));
    expect(fake.files.has("asset.part")).toBe(false);
    expect(await storage.exists("asset")).toBe(true);
    expect((await storage.get("asset"))?.size).toBe(3);
    await storage.delete("asset");
    expect(await storage.get("asset")).toBeNull();
  });

  it("limpia el temporal y el destino cuando falla la escritura", async () => {
    const fake = fakeOpfs();
    fake.setFailWrite(true);
    const storage = createOpfsMediaStorage(async () => fake.directory, true);
    await expect(storage.save("asset", new Blob(["x"]))).rejects.toThrow("write failed");
    expect(fake.files.has("asset.part")).toBe(false);
    expect(fake.files.has("asset")).toBe(false);
  });
});
