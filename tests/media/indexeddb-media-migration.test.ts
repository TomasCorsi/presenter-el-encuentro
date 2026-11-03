import { describe, expect, it } from "bun:test";

import { upgradeMediaDatabase } from "@/services/media/indexeddb-media-repository";

describe("IndexedDB Media v1 → v2", () => {
  it("conserva assets y agrega únicamente el store collections", () => {
    const created: Array<{ name: string; options?: IDBObjectStoreParameters }> = [];
    const database = {
      objectStoreNames: { contains: (name: string) => name === "assets" },
      createObjectStore(name: string, options?: IDBObjectStoreParameters) {
        created.push({ name, options });
        return {} as IDBObjectStore;
      },
    } as IDBDatabase;

    upgradeMediaDatabase(database);

    expect(created).toEqual([{ name: "collections", options: { keyPath: "id" } }]);
  });
});
