import type { MediaAsset, MediaCollection } from "@/domain/media/media";

import type { MediaRepository } from "./media-repository";

/** Repositorio de metadata en memoria, para tests. */
export function createInMemoryMediaRepository(): MediaRepository & {
  assets: Map<string, MediaAsset>;
  collections: Map<string, MediaCollection>;
} {
  const assets = new Map<string, MediaAsset>();
  const collections = new Map<string, MediaCollection>();

  return {
    assets,
    collections,
    async list() {
      return [...assets.values()];
    },
    async get(id) {
      return assets.get(id) ?? null;
    },
    async put(asset) {
      assets.set(asset.id, asset);
    },
    async putMany(nextAssets) {
      for (const asset of nextAssets) assets.set(asset.id, asset);
    },
    async delete(id) {
      assets.delete(id);
    },
    async listCollections() {
      return [...collections.values()];
    },
    async getCollection(id) {
      return collections.get(id) ?? null;
    },
    async putCollection(collection) {
      collections.set(collection.id, collection);
    },
    async deleteCollectionAndUnassign(id, updatedAt) {
      collections.delete(id);
      for (const [assetId, asset] of assets) {
        if (asset.collectionId !== id) continue;
        assets.set(assetId, { ...asset, collectionId: undefined, updatedAt });
      }
    },
  };
}
