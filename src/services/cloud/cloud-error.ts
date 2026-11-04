import { ZodError } from "zod";

export type CloudErrorCode = "unauthorized" | "validation" | "network" | "conflict" | "unknown";

export class CloudRepositoryError extends Error {
  constructor(
    public readonly code: CloudErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CloudRepositoryError";
  }
}

export function normalizeCloudError(error: unknown): CloudRepositoryError {
  if (error instanceof CloudRepositoryError) return error;
  if (error instanceof ZodError) {
    return new CloudRepositoryError("validation", "Los datos cloud no tienen una estructura válida.", { cause: error });
  }
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown } | null;
  const rawCode = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "No se pudo completar la operación cloud.";
  if (candidate?.status === 401 || candidate?.status === 403 || rawCode === "42501") {
    return new CloudRepositoryError("unauthorized", "No tenés permiso para esta operación.", { cause: error });
  }
  if (rawCode === "23505") {
    return new CloudRepositoryError("conflict", "El registro cloud ya existe.", { cause: error });
  }
  if (rawCode.startsWith("22") || rawCode === "23514") {
    return new CloudRepositoryError("validation", "Supabase rechazó los datos enviados.", { cause: error });
  }
  if (error instanceof TypeError || /fetch|network|conexi/i.test(message)) {
    return new CloudRepositoryError("network", "No se pudo contactar a Supabase.", { cause: error });
  }
  return new CloudRepositoryError("unknown", message, { cause: error });
}

