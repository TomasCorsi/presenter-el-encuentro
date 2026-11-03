/// <reference lib="webworker" />

import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";

import { blockingOperationalPaths, isNetworkOnlyPath } from "./cache-policy";

declare const __APP_BUILD_ID__: string;

declare global {
  interface Window {
    readonly __WB_MANIFEST: Array<{ url: string; revision?: string }>;
  }
}

const sw = self as unknown as ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

// `clientsClaim` is intentionally not called. An installed update must not take
// control of an operating Live/Output window without an explicit handoff.
// Workbox busca literalmente este marcador en el bundle de `injectManifest`.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const networkOnly = new NetworkOnly();
for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
  registerRoute(
    ({ url }) => url.origin === sw.location.origin && isNetworkOnlyPath(url.pathname),
    networkOnly,
    method,
  );
}

registerRoute(
  ({ request, url }) => request.method === "GET" && url.origin === sw.location.origin && url.pathname.startsWith("/assets/"),
  new CacheFirst({ cacheName: `presenter-assets-${__APP_BUILD_ID__}` }),
);

registerRoute(
  ({ request, url }) => request.mode === "navigate" && url.origin === sw.location.origin && !isNetworkOnlyPath(url.pathname),
  async ({ request, url }) => {
    const precached = await matchPrecache(url.pathname);
    if (precached) return precached;

    const cache = await caches.open(`presenter-navigation-${__APP_BUILD_ID__}`);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return (await matchPrecache("/")) ?? Response.error();
    }
  },
);

sw.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "CHECK_UPDATE_SAFETY" || data?.type === "SKIP_WAITING") {
    event.waitUntil((async () => {
      const windows = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      const blocked = blockingOperationalPaths(
        windows,
        (event.source as Client | null)?.id ?? null,
      );
      event.ports[0]?.postMessage({ safe: blocked.length === 0, blocked });
      if (data.type === "SKIP_WAITING" && blocked.length === 0) await sw.skipWaiting();
    })());
  }
});
