import { ZodError } from "zod";

export type CloudErrorCode = "unauthorized" | "validation" | "network" | "conflict" | "unknown";

export class CloudRepositoryError extends Error {
  public readonly retryAfterMs: number | undefined;
  constructor(
    public readonly code: CloudErrorCode,
    message: string,
    options?: ErrorOptions,
    retryAfterMs?: number,
  ) {
    super(message, options);
    this.name = "CloudRepositoryError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function normalizeCloudError(error: unknown): CloudRepositoryError {
  if (error instanceof CloudRepositoryError) return error;
  if (error instanceof ZodError) {
    return new CloudRepositoryError(
      "validation",
      "Los datos cloud no tienen una estructura válida.",
      { cause: error },
    );
  }
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
    retryAfter?: unknown;
  } | null;
  const rawCode = typeof candidate?.code === "string" ? candidate.code : "";
  const message =
    typeof candidate?.message === "string"
      ? candidate.message
      : "No se pudo completar la operación cloud.";
  if (candidate?.status === 401 || candidate?.status === 403 || rawCode === "42501") {
    return new CloudRepositoryError("unauthorized", "No tenés permiso para esta operación.", {
      cause: error,
    });
  }
  if (
    candidate?.status === 429 ||
    (typeof candidate?.status === "number" && candidate.status >= 500)
  ) {
    const seconds =
      typeof candidate.retryAfter === "number"
        ? candidate.retryAfter
        : typeof candidate.retryAfter === "string"
          ? Number(candidate.retryAfter)
          : NaN;
    return new CloudRepositoryError(
      "network",
      candidate.status === 429
        ? "Supabase limitó temporalmente las solicitudes."
        : "Supabase no está disponible temporalmente.",
      { cause: error },
      Number.isFinite(seconds) ? seconds * 1_000 : undefined,
    );
  }
  if (rawCode === "23505") {
    return new CloudRepositoryError("conflict", "El registro cloud ya existe.", { cause: error });
  }
  if (rawCode.startsWith("22") || rawCode === "23514") {
    return new CloudRepositoryError("validation", "Supabase rechazó los datos enviados.", {
      cause: error,
    });
  }
  if (error instanceof TypeError || /fetch|network|conexi/i.test(message)) {
    return new CloudRepositoryError("network", "No se pudo contactar a Supabase.", {
      cause: error,
    });
  }
  return new CloudRepositoryError("unknown", message, { cause: error });
}
