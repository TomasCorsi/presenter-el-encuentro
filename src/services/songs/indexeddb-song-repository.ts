import type { Song } from "@/domain/songs/song";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
} from "@/services/local-data/application-database";
import type { SongRepository } from "./song-repository";
import type { LocalDataChangeBus } from "@/services/local-data/local-data-change-bus";
import {
  commitJournalOrAbort,
  journalLocalDelete,
  journalLocalUpsert,
  SYNC_WRITE_STORES,
} from "@/services/sync/sync-journal";

const cloneSong = (song: Song): Song => structuredClone(song);

export function createIndexedDbSongRepository(
  factory: IDBFactory,
  changes?: LocalDataChangeBus,
): SongRepository {
  return {
    async list() {
      const database = await openApplicationDatabase(factory);
      const values = await idbRequest<Song[]>(
        database
          .transaction(APPLICATION_STORES.songs)
          .objectStore(APPLICATION_STORES.songs)
          .getAll(),
      );
      return values.map(cloneSong);
    },
    async get(id) {
      const database = await openApplicationDatabase(factory);
      const value = await idbRequest<Song | undefined>(
        database
          .transaction(APPLICATION_STORES.songs)
          .objectStore(APPLICATION_STORES.songs)
          .get(id),
      );
      return value ? cloneSong(value) : null;
    },
    async create(song) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.songs, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.songs).add(cloneSong(song));
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalUpsert(transaction, "song", song),
      );
      await completed;
      changes?.publish({ entityType: "song", entityId: song.id, origin: "local" });
      return cloneSong(song);
    },
    async update(song) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.songs, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      const store = transaction.objectStore(APPLICATION_STORES.songs);
      const existing = await idbRequest<Song | undefined>(store.get(song.id));
      if (!existing) {
        transaction.abort();
        await completed.catch(() => undefined);
        throw new Error("La canción ya no existe.");
      }
      store.put(cloneSong(song));
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalUpsert(transaction, "song", song),
      );
      await completed;
      changes?.publish({ entityType: "song", entityId: song.id, origin: "local" });
      return cloneSong(song);
    },
    async delete(id) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.songs, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.songs).delete(id);
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalDelete(transaction, "song", id),
      );
      await completed;
      changes?.publish({ entityType: "song", entityId: id, origin: "local" });
    },
  };
}
