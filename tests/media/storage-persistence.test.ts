import { describe, expect, it } from "bun:test";

import {
  requestStoragePersistenceOnce,
  storagePersistenceStatus,
} from "@/services/media/storage-persistence";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("persistent storage", () => {
  it("informa persistent sin volver a solicitar", async () => {
    let requests = 0;
    const status = await requestStoragePersistenceOnce({
      storage: memoryStorage(),
      manager: {
        persisted: async () => true,
        persist: async () => {
          requests += 1;
          return true;
        },
      },
    });
    expect(status).toBe("persistent");
    expect(requests).toBe(0);
  });

  it("solicita una vez y devuelve el resultado concedido", async () => {
    const storage = memoryStorage();
    let requests = 0;
    const manager = {
      persisted: async () => false,
      persist: async () => {
        requests += 1;
        return true;
      },
    };
    expect(await requestStoragePersistenceOnce({ storage, manager })).toBe("persistent");
    expect(await requestStoragePersistenceOnce({ storage, manager })).toBe("not-persistent");
    expect(requests).toBe(1);
  });

  it("una denegación no lanza y no vuelve a solicitar", async () => {
    const storage = memoryStorage();
    let requests = 0;
    const manager = {
      persisted: async () => false,
      persist: async () => {
        requests += 1;
        return false;
      },
    };
    expect(await requestStoragePersistenceOnce({ storage, manager })).toBe("not-persistent");
    expect(await requestStoragePersistenceOnce({ storage, manager })).toBe("not-persistent");
    expect(requests).toBe(1);
  });

  it("tolera API ausente y errores", async () => {
    expect(await requestStoragePersistenceOnce({ storage: null, manager: null })).toBe(
      "unsupported",
    );
    expect(await storagePersistenceStatus(null)).toBe("unsupported");
    expect(
      await requestStoragePersistenceOnce({
        storage: memoryStorage(),
        manager: {
          persisted: async () => {
            throw new Error("denied");
          },
          persist: async () => true,
        },
      }),
    ).toBe("unsupported");
  });
});
