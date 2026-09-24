import type {
  BibleBookMeta,
  BibleChapter,
  BibleVersionMeta,
  CanonicalBible,
} from "@/domain/bible/bible";

import { chapterKey, type BibleRepository } from "./bible-repository";

/**
 * Persistencia local de Bible detrás de repository (ADR-003/039).
 *
 * Es la ÚNICA entidad que no vive en `localStorage`: una Biblia completa supera
 * de largo su cuota. El resto migrará en la Fase 12.
 *
 * Sin dependencias: se usa la API nativa. Solo se instancia en cliente.
 */

const DB_NAME = "broadcast-control.bible";
const DB_VERSION = 1;
const VERSIONS_STORE = "versions";
const BOOKS_STORE = "books";
const CHAPTERS_STORE = "chapters";

interface StoredBooks {
  versionId: string;
  books: BibleBookMeta[];
}

interface StoredChapter extends BibleChapter {
  key: string;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Error de almacenamiento local."));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("La escritura local fue cancelada."));
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo escribir en el almacenamiento."));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        db.createObjectStore(VERSIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "versionId" });
      }
      if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
        const store = db.createObjectStore(CHAPTERS_STORE, { keyPath: "key" });
        store.createIndex("versionId", "versionId", { unique: false });
      }
    };

    open.onsuccess = () => resolve(open.result);
    open.onerror = () =>
      reject(open.error ?? new Error("No se pudo abrir el almacenamiento local de Biblias."));
    open.onblocked = () =>
      reject(new Error("Cierra las demás pestañas de la aplicación e inténtalo de nuevo."));
  });
}

export function createIndexedDbBibleRepository(factory: IDBFactory): BibleRepository {
  let connection: Promise<IDBDatabase> | null = null;
  const db = () => (connection ??= openDatabase(factory));

  async function deleteVersion(database: IDBDatabase, versionId: string): Promise<void> {
    const tx = database.transaction([VERSIONS_STORE, BOOKS_STORE, CHAPTERS_STORE], "readwrite");
    tx.objectStore(VERSIONS_STORE).delete(versionId);
    tx.objectStore(BOOKS_STORE).delete(versionId);

    const index = tx.objectStore(CHAPTERS_STORE).index("versionId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(versionId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };

    await done(tx);
  }

  return {
    async listVersions() {
      const database = await db();
      const tx = database.transaction(VERSIONS_STORE, "readonly");
      const all = await request<BibleVersionMeta[]>(
        tx.objectStore(VERSIONS_STORE).getAll() as IDBRequest<BibleVersionMeta[]>,
      );
      return all.sort((a, b) => a.title.localeCompare(b.title, "es"));
    },

    async getVersion(versionId) {
      const database = await db();
      const tx = database.transaction(VERSIONS_STORE, "readonly");
      const value = await request<BibleVersionMeta | undefined>(
        tx.objectStore(VERSIONS_STORE).get(versionId) as IDBRequest<BibleVersionMeta | undefined>,
      );
      return value ?? null;
    },

    async getBooks(versionId) {
      const database = await db();
      const tx = database.transaction(BOOKS_STORE, "readonly");
      const value = await request<StoredBooks | undefined>(
        tx.objectStore(BOOKS_STORE).get(versionId) as IDBRequest<StoredBooks | undefined>,
      );
      return value?.books ?? [];
    },

    async getChapter(versionId, bookUsfm, chapter) {
      const database = await db();
      const tx = database.transaction(CHAPTERS_STORE, "readonly");
      const value = await request<StoredChapter | undefined>(
        tx.objectStore(CHAPTERS_STORE).get(chapterKey(versionId, bookUsfm, chapter)) as IDBRequest<
          StoredChapter | undefined
        >,
      );
      return value ? { versionId, bookUsfm, number: value.number, verses: value.verses } : null;
    },

    async install(bible: CanonicalBible) {
      const database = await db();
      // Reinstalar reemplaza: nunca quedan capítulos huérfanos de la versión
      // anterior.
      await deleteVersion(database, bible.meta.id);

      const tx = database.transaction([VERSIONS_STORE, BOOKS_STORE, CHAPTERS_STORE], "readwrite");
      tx.objectStore(VERSIONS_STORE).put(bible.meta);
      tx.objectStore(BOOKS_STORE).put({ versionId: bible.meta.id, books: bible.books });

      const chapters = tx.objectStore(CHAPTERS_STORE);
      for (const chapter of bible.chapters) {
        chapters.put({
          ...chapter,
          key: chapterKey(bible.meta.id, chapter.bookUsfm, chapter.number),
        } satisfies StoredChapter);
      }

      await done(tx);
      return bible.meta;
    },

    async delete(versionId) {
      await deleteVersion(await db(), versionId);
    },
  };
}
