import { BACKUP_LIMITS } from "@/domain/backup/backup";

const encoder = new TextEncoder();

export function encodeNdjson(values: readonly unknown[]): Uint8Array {
  const lines = values.map((value) => JSON.stringify(value));
  for (const line of lines) {
    if (encoder.encode(line).byteLength > BACKUP_LIMITS.recordBytes) {
      throw new Error("Un registro supera el límite de 16 MiB.");
    }
  }
  return encoder.encode(lines.length ? `${lines.join("\n")}\n` : "");
}

export function parseNdjson(bytes: Uint8Array, maximumRecords: number): unknown[] {
  if (bytes.byteLength > BACKUP_LIMITS.structuredBytes) {
    throw new Error("Los datos estructurados exceden el límite permitido.");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!text) return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > maximumRecords) throw new Error("El backup contiene demasiados registros.");
  return lines.map((line) => {
    if (encoder.encode(line).byteLength > BACKUP_LIMITS.recordBytes) {
      throw new Error("Un registro NDJSON supera el límite permitido.");
    }
    return JSON.parse(line) as unknown;
  });
}
