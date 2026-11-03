export type RuntimeCachePolicy = "network-only" | "navigation" | "immutable-asset";

export interface CacheRequestDescriptor {
  url: string;
  method: string;
  mode?: string;
}

export function isNetworkOnlyPath(pathname: string): boolean {
  return pathname === "/api/output-relay" ||
    pathname.startsWith("/api/") ||
    pathname === "/_serverFn" ||
    pathname.startsWith("/_serverFn/");
}

export function classifyRuntimeRequest(
  request: CacheRequestDescriptor,
  origin: string,
): RuntimeCachePolicy {
  if (request.method.toUpperCase() !== "GET") return "network-only";
  if (request.url.startsWith("blob:")) return "network-only";
  const url = new URL(request.url, origin);
  if (url.origin !== origin || isNetworkOnlyPath(url.pathname)) return "network-only";
  if (request.mode === "navigate") return "navigation";
  if (url.pathname.startsWith("/assets/")) return "immutable-asset";
  return "network-only";
}

export const OPERATIONAL_PATHS = [
  "/live",
  "/output/main",
  "/output/stage",
  "/output/stream",
] as const;

export function isOperationalPath(pathname: string): boolean {
  return OPERATIONAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export interface WindowClientDescriptor {
  id: string;
  url: string;
}

export function blockingOperationalPaths(
  clients: readonly WindowClientDescriptor[],
  requesterId: string | null,
): string[] {
  return clients
    .filter((client) => client.id !== requesterId)
    .map((client) => new URL(client.url).pathname)
    .filter(isOperationalPath);
}
