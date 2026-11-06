import { digestStream } from "./backup-integrity";
import { createUuid } from "@/utils/create-id";

export async function hashBlobOffMainThread(
  blob: Blob,
  maximumBytes: number,
): Promise<{ sha256: string; bytes: number }> {
  if (typeof Worker === "undefined") return digestStream(blob.stream(), maximumBytes);
  const worker = new Worker(new URL("../../workers/backup.worker.ts", import.meta.url), {
    type: "module",
    name: "presenter-backup-integrity",
  });
  const id = createUuid();
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<{
          id: string;
          result?: { sha256: string; bytes: number };
          error?: string;
        }>,
      ) => {
        if (event.data.id !== id) return;
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error ?? "El worker de backup falló."));
      };
      worker.onerror = () => reject(new Error("El worker de backup falló."));
      worker.postMessage({ id, blob, maximumBytes });
    });
  } finally {
    worker.terminate();
  }
}
