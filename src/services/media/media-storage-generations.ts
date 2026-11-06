import { createIndexedDbBlobMediaStorage } from "./indexeddb-blob-media-storage";
import {
  createBrowserOpfsMediaStorage,
  deleteBrowserOpfsMediaGeneration,
  isOpfsAvailable,
} from "./opfs-media-storage";
import type { MediaFileStorage } from "./media-file-storage";

export const ACTIVE_MEDIA_GENERATION_KEY = "broadcast-control.media.active-generation.v1";
export const LEGACY_MEDIA_GENERATION = "legacy";

export interface MediaStorageGenerationManager {
  activeGeneration(): string;
  open(generation?: string): MediaFileStorage;
  activate(generation: string): void;
  deleteGeneration(generation: string): Promise<void>;
}

function validGeneration(value: string | null): string {
  return value && /^(legacy|restore-[a-f0-9-]{36})$/.test(value) ? value : LEGACY_MEDIA_GENERATION;
}

export function createBrowserMediaStorageGenerationManager(
  factory: IDBFactory,
  storage: Pick<Storage, "getItem" | "setItem">,
): MediaStorageGenerationManager {
  const opfs = isOpfsAvailable();
  return {
    activeGeneration: () => validGeneration(storage.getItem(ACTIVE_MEDIA_GENERATION_KEY)),
    open(generation = validGeneration(storage.getItem(ACTIVE_MEDIA_GENERATION_KEY))) {
      return opfs
        ? createBrowserOpfsMediaStorage(generation)
        : createIndexedDbBlobMediaStorage(factory, generation);
    },
    activate(generation) {
      storage.setItem(ACTIVE_MEDIA_GENERATION_KEY, validGeneration(generation));
    },
    async deleteGeneration(generation) {
      if (generation === LEGACY_MEDIA_GENERATION) return;
      if (opfs) await deleteBrowserOpfsMediaGeneration(generation);
      else {
        const files = createIndexedDbBlobMediaStorage(factory, generation);
        if ("clearGeneration" in files) {
          await (
            files as MediaFileStorage & { clearGeneration(): Promise<void> }
          ).clearGeneration();
        }
      }
    },
  };
}
