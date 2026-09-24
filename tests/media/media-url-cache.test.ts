import { describe, expect, it } from "bun:test";

import type { MediaFileStorage, MediaUrlHandle } from "@/services/media/media-file-storage";
import { createMediaUrlCache } from "@/services/media/media-url-cache";

function storageWithHandles() {
  let created = 0;
  let released = 0;
  const missing = new Set<string>();
  const storage: MediaFileStorage = {
    kind: "memory",
    save: async () => undefined,
    get: async () => null,
    delete: async () => undefined,
    exists: async () => false,
    async getUrl(id): Promise<MediaUrlHandle | null> {
      if (missing.has(id)) return null;
      created += 1;
      return {
        url: `blob:${id}:${created}`,
        release: () => {
          released += 1;
        },
      };
    },
  };
  return { storage, missing, counts: () => ({ created, released }) };
}

describe("MediaUrlCache", () => {
  it("reutiliza una URL y la libera al invalidar", async () => {
    const fake = storageWithHandles();
    const cache = createMediaUrlCache(fake.storage);
    expect(await cache.getUrl("a")).toBe("blob:a:1");
    expect(await cache.getUrl("a")).toBe("blob:a:1");
    expect(fake.counts()).toEqual({ created: 1, released: 0 });
    cache.invalidate("a");
    await Promise.resolve();
    expect(fake.counts()).toEqual({ created: 1, released: 1 });
    expect(await cache.getUrl("a")).toBe("blob:a:2");
  });

  it("releaseAll libera todos los handles", async () => {
    const fake = storageWithHandles();
    const cache = createMediaUrlCache(fake.storage);
    await Promise.all([cache.getUrl("a"), cache.getUrl("b")]);
    cache.releaseAll();
    await Promise.resolve();
    expect(fake.counts()).toEqual({ created: 2, released: 2 });
  });

  it("un archivo ausente no queda cacheado", async () => {
    const fake = storageWithHandles();
    fake.missing.add("x");
    const cache = createMediaUrlCache(fake.storage);
    expect(await cache.getUrl("x")).toBeNull();
    fake.missing.delete("x");
    expect(await cache.getUrl("x")).toBe("blob:x:1");
  });
});
