import type { Project } from "@/domain/projects/project";
import type { ProjectRepository } from "./project-repository";
import {
  APPLICATION_STORES,
  idbRequest,
  idbTransactionDone,
  openApplicationDatabase,
  type ApplicationMetaRecord,
} from "@/services/local-data/application-database";
import type { LocalDataChangeBus } from "@/services/local-data/local-data-change-bus";
import {
  commitJournalOrAbort,
  journalLocalDelete,
  journalLocalUpsert,
  SYNC_WRITE_STORES,
} from "@/services/sync/sync-journal";

export const ACTIVE_PROJECT_META_KEY = "activeProjectId";

function cloneProject(project: Project): Project {
  return structuredClone(project);
}

export function createIndexedDbProjectRepository(
  factory: IDBFactory,
  changes?: LocalDataChangeBus,
): ProjectRepository {
  return {
    async list() {
      const database = await openApplicationDatabase(factory);
      const values = await idbRequest<Project[]>(
        database
          .transaction(APPLICATION_STORES.projects)
          .objectStore(APPLICATION_STORES.projects)
          .getAll(),
      );
      return values.map(cloneProject);
    },
    async get(id) {
      const database = await openApplicationDatabase(factory);
      const value = await idbRequest<Project | undefined>(
        database
          .transaction(APPLICATION_STORES.projects)
          .objectStore(APPLICATION_STORES.projects)
          .get(id),
      );
      return value ? cloneProject(value) : null;
    },
    async create(project) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.projects, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.projects).add(cloneProject(project));
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalUpsert(transaction, "project", project),
      );
      await completed;
      changes?.publish({ entityType: "project", entityId: project.id, origin: "local" });
      return cloneProject(project);
    },
    async update(project) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.projects, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      const store = transaction.objectStore(APPLICATION_STORES.projects);
      const existing = await idbRequest<Project | undefined>(store.get(project.id));
      if (!existing) {
        transaction.abort();
        await completed.catch(() => undefined);
        throw new Error("El proyecto ya no existe.");
      }
      store.put(cloneProject(project));
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalUpsert(transaction, "project", project),
      );
      await completed;
      changes?.publish({ entityType: "project", entityId: project.id, origin: "local" });
      return cloneProject(project);
    },
    async delete(id) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.projects, ...SYNC_WRITE_STORES],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      transaction.objectStore(APPLICATION_STORES.projects).delete(id);
      await commitJournalOrAbort(
        transaction,
        completed,
        journalLocalDelete(transaction, "project", id),
      );
      const metaStore = transaction.objectStore(APPLICATION_STORES.meta);
      const active = await idbRequest<ApplicationMetaRecord<string | null> | undefined>(
        metaStore.get(ACTIVE_PROJECT_META_KEY),
      );
      if (active?.value === id) {
        metaStore.put({
          key: ACTIVE_PROJECT_META_KEY,
          value: null,
        } satisfies ApplicationMetaRecord);
      }
      await completed;
      changes?.publish({ entityType: "project", entityId: id, origin: "local" });
    },
    async getActiveProjectId() {
      const database = await openApplicationDatabase(factory);
      const value = await idbRequest<ApplicationMetaRecord<string | null> | undefined>(
        database
          .transaction(APPLICATION_STORES.meta)
          .objectStore(APPLICATION_STORES.meta)
          .get(ACTIVE_PROJECT_META_KEY),
      );
      return typeof value?.value === "string" ? value.value : null;
    },
    async setActiveProjectId(projectId) {
      const database = await openApplicationDatabase(factory);
      const transaction = database.transaction(
        [APPLICATION_STORES.projects, APPLICATION_STORES.meta],
        "readwrite",
      );
      const completed = idbTransactionDone(transaction);
      if (projectId) {
        const project = await idbRequest<Project | undefined>(
          transaction.objectStore(APPLICATION_STORES.projects).get(projectId),
        );
        if (!project) {
          transaction.abort();
          await completed.catch(() => undefined);
          throw new Error("No se puede activar un proyecto inexistente.");
        }
      }
      transaction.objectStore(APPLICATION_STORES.meta).put({
        key: ACTIVE_PROJECT_META_KEY,
        value: projectId,
      } satisfies ApplicationMetaRecord);
      await completed;
    },
  };
}
