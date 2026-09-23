import type { MediaAsset } from "@/domain/media/media";

import type { MediaRepository } from "./media-repository";

/** Repositorio de metadata en memoria, para tests. */
export function createInMemoryMediaRepository(): MediaRepository & { assets: Map<string, MediaAsset> } {
  const assets = new Map<string, MediaAsset>();

  return {
    assets,
    async list() {
      return [...assets.values()];
    },
    async get(id) {
      return assets.get(id) ?? null;
    },
    async put(asset) {
      assets.set(asset.id, asset);
    },
    async delete(id) {
      assets.delete(id);
    },
  };
}
