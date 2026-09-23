import type { MediaKind } from "@/domain/media/media";

/**
 * Lectura de metadata visual y miniaturas a partir de un File.
 *
 * Client-only y no bloqueante: usa una URL de objeto TEMPORAL que se revoca
 * siempre, y nunca lee el archivo entero a memoria (el navegador decodifica
 * desde el Blob). Cualquier fallo (códec no soportado, imagen corrupta)
 * devuelve `null` y NO impide la importación.
 */

export interface VisualMediaInfo {
  width: number;
  height: number;
  durationSeconds?: number | undefined;
  thumbnailDataUrl?: string | undefined;
}

const LOAD_TIMEOUT_MS = 10_000;
const THUMBNAIL_MAX_SIZE = 160;
const VIDEO_THUMBNAIL_AT_SECONDS = 0.1;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function captureThumbnail(
  width: number,
  height: number,
  source: HTMLImageElement | HTMLVideoElement,
): string | undefined {
  if (width <= 0 || height <= 0) return undefined;
  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}

async function readImageInfo(file: Blob): Promise<VisualMediaInfo | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
        image.src = url;
      }),
    );
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    return { width, height, thumbnailDataUrl: captureThumbnail(width, height, image) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readVideoInfo(file: Blob): Promise<VisualMediaInfo | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("No se pudo leer el video."));
        video.src = url;
      }),
    );
    const width = video.videoWidth;
    const height = video.videoHeight;
    const durationSeconds =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;

    // Miniatura: captura un fotograma cercano al inicio. Falla sin romper.
    let thumbnailDataUrl: string | undefined;
    try {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.currentTime = VIDEO_THUMBNAIL_AT_SECONDS;
          setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
        }),
      );
      thumbnailDataUrl = captureThumbnail(width, height, video);
    } catch {
      thumbnailDataUrl = undefined;
    }

    return { width, height, durationSeconds, thumbnailDataUrl };
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

/** Lee metadata visual del archivo; `null` ante cualquier fallo. */
export async function readVisualMediaInfo(
  file: Blob,
  kind: MediaKind,
): Promise<VisualMediaInfo | null> {
  try {
    return kind === "image" ? await readImageInfo(file) : await readVideoInfo(file);
  } catch {
    return null;
  }
}
