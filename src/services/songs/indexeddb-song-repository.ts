import type { Song } from "@/domain/songs/song";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import type { SongRepository } from "./song-repository";

const cloneSong = (song: Song): Song => structuredClone(song);

export function createIndexedDbSongRepository(factory: IDBFactory): SongRepository {
  return {
    async list() {
      const database = await openApplicationDatabase(factory);
      const values = await idbRequest<Song[]>(
        database.transaction(APPLICATION_STORES.songs).objectStore(APPLICATION_STORES.songs).getAll(),
      );
      return values.map(cloneSong);
    },
    async get(id) {
      const database = await openApplicationDatabase(factory);
      const value = await idbRequest<Song | undefined>(
        database.transaction(APPLICATION_STORES.songs).objectStore(APPLICATION_STORES.songs).get(id),
      );
      return value ? cloneSong(value) : null;
    },
    async create(song) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.songs, "readwrite");
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.songs).add(cloneSong(song));
      await completed;
      return cloneSong(song);
    },
    async update(song) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.songs, "readwrite");
      const completed = idbTransactionDone(transaction);
      const store = transaction.objectStore(APPLICATION_STORES.songs);
      const existing = await idbRequest<Song | undefined>(store.get(song.id));
      if (!existing) {
        transaction.abort();
        await completed.catch(() => undefined);
        throw new Error("La canción ya no existe.");
      }
      store.put(cloneSong(song));
      await completed;
      return cloneSong(song);
    },
    async delete(id) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(APPLICATION_STORES.songs, "readwrite");
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.songs).delete(id);
      await completed;
    },
  };
}
