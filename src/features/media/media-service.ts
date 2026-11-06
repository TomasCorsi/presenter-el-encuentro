import type { MediaAsset, MediaCollection } from "@/domain/media/media";
import {
  findMediaUsage,
  mediaKindForMime,
  normalizeMediaTags,
  normalizeMediaText,
  validateMediaFile,
  type MediaUsage,
} from "@/domain/media/media-rules";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import type { MediaRepository } from "@/services/media/media-repository";
import type { ProjectRepository } from "@/services/projects/project-repository";
import { createUuid } from "@/utils/create-id";

import { readVisualMediaInfo } from "./read-media-info";

/**
 * Coordinador de la biblioteca Media. Combina la metadata (repository), los
 * bytes (storage) y el uso en Projects (referencias de solo lectura).
 *
 * Contratos clave:
 * - Importación ATÓMICA y compensable: primero los bytes, después la
 *   metadata; si la metadata falla, los bytes se borran. Si los bytes
 *   fallan, no queda nada.
 * - Eliminación BLOQUEADA por uso: un asset referenciado desde Projects no
 *   se borra nunca.
 * - Los videos se rechazan cuando OPFS no está disponible: el respaldo
 *   (IndexedDB Blob) es solo para imágenes razonablemente pequeñas.
 */
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly fileStorage: MediaFileStorage,
    private readonly projects: Pick<ProjectRepository, "list">,
    private readonly workspaceId: string = "local-media",
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = createUuid,
    /** Lectura de metadata visual (no bloqueante). Inyectable para tests. */
    private readonly readInfo: typeof readVisualMediaInfo = readVisualMediaInfo,
    /** Preparación best-effort del storage; jamás debe bloquear importación. */
    private readonly prepareStorage: () => Promise<unknown> = async () => undefined,
  ) {}

  async list(): Promise<MediaAsset[]> {
    const assets = await this.repository.list();
    return assets.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async get(id: string): Promise<MediaAsset | null> {
    return this.repository.get(id);
  }

  /** Los videos necesitan OPFS: fuera de él se rechazan con mensaje claro. */
  canImport(file: { mimeType: string }): boolean {
    const kind = mediaKindForMime(file.mimeType);
    return kind === "image" || (kind === "video" && this.fileStorage.kind === "opfs");
  }

  async importFiles(
    files: readonly File[],
    options: { collectionId?: string } = {},
  ): Promise<{ imported: MediaAsset[]; errors: string[] }> {
    // Se inicia dentro del gesto de importación, pero no se espera: una
    // denegación de persistencia nunca retrasa ni cancela el guardado.
    void this.prepareStorage().catch(() => undefined);

    const imported: MediaAsset[] = [];
    const errors: string[] = [];

    if (options.collectionId && !(await this.repository.getCollection(options.collectionId))) {
      return { imported, errors: ["La colección seleccionada ya no existe."] };
    }

    for (const file of files) {
      const error = await this.importOne(file, options.collectionId);
      if (error instanceof Error) errors.push(error.message);
      else imported.push(error);
    }

    return { imported, errors };
  }

  /** Importa un archivo; devuelve el asset o el Error. Nunca lanza. */
  private async importOne(file: File, collectionId?: string): Promise<MediaAsset | Error> {
    const invalid = validateMediaFile({
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (invalid) return new Error(invalid);

    const kind = mediaKindForMime(file.type);
    if (kind === "video" && this.fileStorage.kind !== "opfs") {
      return new Error(
        `«${file.name}» es un video y este navegador no soporta el almacenamiento de archivos grandes (OPFS). Usa Chrome, Edge o Firefox recientes.`,
      );
    }

    const id = this.newId();
    const name = file.name.replace(/\.[^.]+$/, "").trim() || file.name;

    // 1. Bytes primero (streaming en OPFS).
    try {
      await this.fileStorage.save(id, file);
    } catch (cause) {
      return new Error(
        `No se pudo guardar «${file.name}». Espacio insuficiente o almacenamiento no disponible.`,
        { cause },
      );
    }

    // 2. Metadata visual (no bloqueante).
    const info = await this.readInfo(file, kind ?? "image").catch(() => null);

    // MIME/container no garantiza que el navegador pueda decodificar el
    // códec real. Un video ilegible no entra a la biblioteca y no deja bytes.
    if (kind === "video" && info === null) {
      await this.fileStorage.delete(id).catch(() => undefined);
      return new Error(
        `No se pudo leer «${file.name}». El contenedor MP4/WEBM está admitido, pero el códec debe ser compatible con este navegador.`,
      );
    }

    // 3. Metadata después; si falla, compensación: borrar los bytes.
    const timestamp = this.now().toISOString();
    const asset: MediaAsset = {
      id,
      workspaceId: this.workspaceId,
      name,
      kind: kind ?? "image",
      mimeType: file.type,
      sizeBytes: file.size,
      storage: this.fileStorage.kind,
      width: info?.width,
      height: info?.height,
      durationSeconds: info?.durationSeconds,
      thumbnailDataUrl: info?.thumbnailDataUrl,
      collectionId,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      presentationUpdatedAt: timestamp,
    };
    try {
      await this.repository.put(asset);
    } catch (cause) {
      await this.fileStorage.delete(id).catch(() => undefined);
      return new Error(`No se pudo registrar «${file.name}» en la biblioteca.`, { cause });
    }

    return asset;
  }

  async rename(id: string, name: string): Promise<MediaAsset> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("El nombre no puede estar vacío.");
    const asset = await this.repository.get(id);
    if (!asset) throw new Error("El archivo ya no existe en la biblioteca.");
    const timestamp = this.now().toISOString();
    const updated: MediaAsset = {
      ...asset,
      name: trimmed,
      updatedAt: timestamp,
      presentationUpdatedAt: timestamp,
    };
    await this.repository.put(updated);
    return updated;
  }

  async listCollections(): Promise<MediaCollection[]> {
    return (await this.repository.listCollections()).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
  }

  async createCollection(name: string): Promise<MediaCollection> {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) throw new Error("El nombre de la colección no puede estar vacío.");
    await this.assertUniqueCollectionName(trimmed);
    const timestamp = this.now().toISOString();
    const collection: MediaCollection = {
      id: this.newId(),
      workspaceId: this.workspaceId,
      name: trimmed,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.putCollection(collection);
    return collection;
  }

  async renameCollection(id: string, name: string): Promise<MediaCollection> {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) throw new Error("El nombre de la colección no puede estar vacío.");
    const collection = await this.repository.getCollection(id);
    if (!collection) throw new Error("La colección ya no existe.");
    await this.assertUniqueCollectionName(trimmed, id);
    const updated = { ...collection, name: trimmed, updatedAt: this.now().toISOString() };
    await this.repository.putCollection(updated);
    return updated;
  }

  async deleteCollection(id: string): Promise<void> {
    if (!(await this.repository.getCollection(id))) throw new Error("La colección ya no existe.");
    await this.repository.deleteCollectionAndUnassign(id, this.now().toISOString());
  }

  async moveToCollection(ids: readonly string[], collectionId?: string): Promise<MediaAsset[]> {
    if (collectionId && !(await this.repository.getCollection(collectionId))) {
      throw new Error("La colección seleccionada ya no existe.");
    }
    return this.updateOrganization(ids, (asset) => ({ ...asset, collectionId }));
  }

  async replaceTags(id: string, tags: readonly string[]): Promise<MediaAsset> {
    const [updated] = await this.updateOrganization([id], (asset) => ({
      ...asset,
      tags: normalizeMediaTags(tags),
    }));
    if (!updated) throw new Error("El archivo ya no existe en la biblioteca.");
    return updated;
  }

  async addTags(ids: readonly string[], tags: readonly string[]): Promise<MediaAsset[]> {
    const additions = normalizeMediaTags(tags);
    return this.updateOrganization(ids, (asset) => ({
      ...asset,
      tags: normalizeMediaTags([...(asset.tags ?? []), ...additions]),
    }));
  }

  async removeTags(ids: readonly string[], tags: readonly string[]): Promise<MediaAsset[]> {
    const removals = new Set(normalizeMediaTags(tags).map(normalizeMediaText));
    return this.updateOrganization(ids, (asset) => ({
      ...asset,
      tags: (asset.tags ?? []).filter((tag) => !removals.has(normalizeMediaText(tag))),
    }));
  }

  async usage(id: string): Promise<MediaUsage> {
    return findMediaUsage(await this.projects.list(), id);
  }

  async exists(id: string): Promise<boolean> {
    return this.fileStorage.exists(id);
  }

  /**
   * Elimina el asset; si algún Project lo referencia, lanza
   * MediaInUseError SIN tocar nada. Sin uso: bytes primero, metadata después.
   */
  async delete(id: string): Promise<void> {
    const usage = await this.usage(id);
    if (usage.occurrences > 0) {
      throw new MediaInUseError(id, usage.occurrences, usage.projectNames);
    }
    await this.fileStorage.delete(id);
    await this.repository.delete(id);
  }

  async deleteMany(ids: readonly string[]): Promise<MediaDeleteManyResult> {
    const uniqueIds = [...new Set(ids)];
    const projects = await this.projects.list();
    const blocked = uniqueIds.flatMap((id) => {
      const usage = findMediaUsage(projects, id);
      return usage.occurrences > 0 ? [{ mediaId: id, usage }] : [];
    });
    if (blocked.length > 0) throw new MediaBatchInUseError(blocked);

    const completed: MediaAsset[] = [];
    const failed: MediaDeleteFailure[] = [];
    for (const id of uniqueIds) {
      const asset = await this.repository.get(id);
      if (!asset) {
        failed.push({ mediaId: id, name: id, message: "El archivo ya no existe." });
        continue;
      }
      try {
        await this.fileStorage.delete(id);
        await this.repository.delete(id);
        completed.push(asset);
      } catch (error) {
        failed.push({
          mediaId: id,
          name: asset.name,
          message: error instanceof Error ? error.message : "No se pudo eliminar.",
        });
      }
    }
    return { completed, failed };
  }

  private async updateOrganization(
    ids: readonly string[],
    update: (asset: MediaAsset) => MediaAsset,
  ): Promise<MediaAsset[]> {
    const uniqueIds = [...new Set(ids)];
    const assets = await Promise.all(uniqueIds.map((id) => this.repository.get(id)));
    if (assets.some((asset) => asset === null)) {
      throw new Error("Uno o más archivos ya no existen en la biblioteca.");
    }
    const timestamp = this.now().toISOString();
    const updated = (assets as MediaAsset[]).map((asset) => ({
      ...update(asset),
      updatedAt: timestamp,
      presentationUpdatedAt: asset.presentationUpdatedAt,
    }));
    await this.repository.putMany(updated);
    return updated;
  }

  private async assertUniqueCollectionName(name: string, exceptId?: string): Promise<void> {
    const key = normalizeMediaText(name);
    const duplicate = (await this.repository.listCollections()).some(
      (collection) => collection.id !== exceptId && normalizeMediaText(collection.name) === key,
    );
    if (duplicate) throw new Error("Ya existe una colección con ese nombre.");
  }
}

export interface MediaDeleteFailure {
  mediaId: string;
  name: string;
  message: string;
}

export interface MediaDeleteManyResult {
  completed: MediaAsset[];
  failed: MediaDeleteFailure[];
}

export interface BlockedMediaDelete {
  mediaId: string;
  usage: MediaUsage;
}

export class MediaBatchInUseError extends Error {
  constructor(readonly blocked: readonly BlockedMediaDelete[]) {
    super(
      blocked.length === 1
        ? "Un archivo está en uso. No se eliminó ningún elemento."
        : `${blocked.length} archivos están en uso. No se eliminó ningún elemento.`,
    );
    this.name = "MediaBatchInUseError";
  }
}

/** El asset está referenciado desde Projects: la eliminación se bloquea. */
export class MediaInUseError extends Error {
  constructor(
    readonly mediaId: string,
    readonly occurrences: number,
    readonly projectNames: readonly string[],
  ) {
    super(
      occurrences === 1
        ? `Este archivo se usa en un elemento de «${projectNames[0] ?? "un proyecto"}». Quítalo del proyecto para poder eliminarlo.`
        : `Este archivo se usa en ${occurrences} elementos (${projectNames.join(", ")}). Quítalo de los proyectos para poder eliminarlo.`,
    );
    this.name = "MediaInUseError";
  }
}
