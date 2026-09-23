import type { MediaStorageKind } from "@/domain/media/media";

/**
 * URL local y temporal de un asset. `release()` libera el recurso (por
 * ejemplo revoca el `blob:`): quien la pide es responsable de liberarla.
 */
export interface MediaUrlHandle {
  url: string;
  release(): void;
}

/**
 * Almacenamiento físico de los BYTES de Media. Solo bytes: no conoce
 * metadata, Projects ni la UI.
 *
 * La interfaz es el punto de sustitución para el futuro `.exe`
 * (`NativeFileSystemMediaStorage`): UI, dominio, Project, Live y Output no
 * dependen de OPFS.
 */
export interface MediaFileStorage {
  readonly kind: MediaStorageKind;
  /** Escribe el archivo completo; en OPFS usa streaming (nunca arrayBuffer). */
  save(id: string, file: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  /** `null` si el archivo no está. */
  getUrl(id: string): Promise<MediaUrlHandle | null>;
}
