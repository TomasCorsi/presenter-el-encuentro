import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { BACKUP_LIMITS } from "@/domain/backup/backup";

export function sha256Bytes(value: Uint8Array): string {
  return bytesToHex(sha256(value));
}

export async function digestStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes = BACKUP_LIMITS.totalBytes,
  signal?: AbortSignal,
): Promise<{ sha256: string; bytes: number }> {
  const hash = sha256.create();
  const reader = stream.getReader();
  let bytes = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) throw new Error("La entrada excede el límite permitido.");
      hash.update(next.value);
    }
    return { sha256: bytesToHex(hash.digest()), bytes };
  } finally {
    reader.releaseLock();
  }
}

export function hashingTransform(onDone: (result: { sha256: string; bytes: number }) => void) {
  const hash = sha256.create();
  let bytes = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > BACKUP_LIMITS.totalBytes)
        throw new Error("La entrada excede el límite permitido.");
      hash.update(chunk);
      controller.enqueue(chunk);
    },
    flush() {
      onDone({ sha256: bytesToHex(hash.digest()), bytes });
    },
  });
}

export function hashingWritable(
  onDone: (result: { sha256: string; bytes: number }) => void,
  maximumBytes = BACKUP_LIMITS.totalBytes,
): WritableStream<Uint8Array> {
  const hash = sha256.create();
  let bytes = 0;
  return new WritableStream({
    write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) throw new Error("La entrada excede el límite permitido.");
      hash.update(chunk);
    },
    close() {
      onDone({ sha256: bytesToHex(hash.digest()), bytes });
    },
  });
}
