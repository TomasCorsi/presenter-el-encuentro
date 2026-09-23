import type { MediaAsset } from "@/domain/media/media";
import { findMediaUsage, mediaKindForMime, validateMediaFile } from "@/domain/media/media-rules";
import type { MediaFileStorage } from "@/services/media/media-file-storage";
import type { MediaRepository } from "@/services/media/media-repository";
import type { ProjectRepository } from "@/services/projects/project-repository";

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
    private readonly newId: () => string = () => crypto.randomUUID(),
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

  async importFiles(files: readonly File[]): Promise<{ imported: MediaAsset[]; errors: string[] }> {
    const imported: MediaAsset[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const error = await this.importOne(file);
      if (error instanceof Error) errors.push(error.message);
      else imported.push(error);
    }

    return { imported, errors };
  }

  /** Importa un archivo; devuelve el asset o el Error. Nunca lanza. */
  private async importOne(file: File): Promise<MediaAsset | Error> {
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
    const info = await readVisualMediaInfo(file, kind ?? "image");

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
      createdAt: timestamp,
      updatedAt: timestamp,
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
    const updated: MediaAsset = { ...asset, name: trimmed, updatedAt: this.now().toISOString() };
    await this.repository.put(updated);
    return updated;
  }

  /**
   * Elimina el asset; si algún Project lo referencia, lanza
   * MediaInUseError SIN tocar nada. Sin uso: bytes primero, metadata después.
   */
  async delete(id: string): Promise<void> {
    const usage = findMediaUsage(await this.projects.list(), id);
    if (usage.occurrences > 0) {
      throw new MediaInUseError(id, usage.occurrences, usage.projectNames);
    }
    await this.fileStorage.delete(id);
    await this.repository.delete(id);
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
