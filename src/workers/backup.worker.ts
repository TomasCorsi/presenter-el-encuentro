/// <reference lib="webworker" />

import { digestStream } from "@/services/backup/backup-integrity";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<{ id: string; blob: Blob; maximumBytes: number }>) => {
  const { id, blob, maximumBytes } = event.data;
  void digestStream(blob.stream(), maximumBytes).then(
    (result) => worker.postMessage({ id, result }),
    (reason: unknown) =>
      worker.postMessage({
        id,
        error: reason instanceof Error ? reason.message : "No se pudo calcular el checksum.",
      }),
  );
};

export {};
