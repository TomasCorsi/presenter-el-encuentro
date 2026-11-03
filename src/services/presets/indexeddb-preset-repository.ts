import type { Preset } from "@/domain/presets/preset";
import { cloneStyle } from "@/domain/presets/preset-rules";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import type { PresetRepository } from "./preset-repository";

const clonePreset = (preset: Preset): Preset => ({ ...preset, style: cloneStyle(preset.style) });

export function createIndexedDbPresetRepository(factory: IDBFactory): PresetRepository {
  return {
    async list() {
      const database = await openApplicationDatabase(factory);
      const values = await idbRequest<Preset[]>(
        database.transaction(APPLICATION_STORES.presets).objectStore(APPLICATION_STORES.presets).getAll(),
      );
      return values.map(clonePreset);
    },
    async get(id) {
      const database = await openApplicationDatabase(factory);
      const value = await idbRequest<Preset | undefined>(
        database.transaction(APPLICATION_STORES.presets).objectStore(APPLICATION_STORES.presets).get(id),
      );
      return value ? clonePreset(value) : null;
    },
    async create(preset) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.presets, "readwrite");
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.presets).add(clonePreset(preset));
      await completed;
      return clonePreset(preset);
    },
    async update(preset) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.presets, "readwrite");
      const completed = idbTransactionDone(transaction);
      const store = transaction.objectStore(APPLICATION_STORES.presets);
      const existing = await idbRequest<Preset | undefined>(store.get(preset.id));
      if (!existing) {
        transaction.abort();
        await completed.catch(() => undefined);
        throw new Error("El preset ya no existe.");
      }
      store.put(clonePreset(preset));
      await completed;
      return clonePreset(preset);
    },
    async delete(id) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.presets, "readwrite");
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.presets).delete(id);
      await completed;
    },
  };
}
