import { describe, expect, it } from "bun:test";

import {
  blockingOperationalPaths,
  classifyRuntimeRequest,
  isNetworkOnlyPath,
  isOperationalPath,
} from "@/pwa/cache-policy";

const origin = "http://localhost:3000";

describe("PWA cache policy", () => {
  it("fuerza relay, APIs y server functions a Network Only", () => {
    for (const path of ["/api/output-relay", "/api/media", "/_serverFn/action"]) {
      expect(isNetworkOnlyPath(path)).toBeTrue();
      expect(classifyRuntimeRequest({ url: `${origin}${path}`, method: "GET" }, origin)).toBe("network-only");
    }
  });

  it("nunca cachea métodos mutables, cross-origin ni blob", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(classifyRuntimeRequest({ url: `${origin}/projects`, method }, origin)).toBe("network-only");
    }
    expect(classifyRuntimeRequest({ url: "https://example.com/a.js", method: "GET" }, origin)).toBe("network-only");
    for (const path of ["/auth/v1/token", "/rest/v1/projects", "/realtime/v1/websocket", "/storage/v1/object/media"]) {
      expect(classifyRuntimeRequest({ url: `https://church.supabase.co${path}`, method: "GET" }, origin)).toBe("network-only");
    }
    expect(classifyRuntimeRequest({ url: "blob:http://localhost/id", method: "GET" }, origin)).toBe("network-only");
  });

  it("limita runtime cache a navegaciones same-origin y assets hashed", () => {
    expect(classifyRuntimeRequest({ url: `${origin}/live`, method: "GET", mode: "navigate" }, origin)).toBe("navigation");
    expect(classifyRuntimeRequest({ url: `${origin}/assets/app-123.js`, method: "GET" }, origin)).toBe("immutable-asset");
    expect(classifyRuntimeRequest({ url: `${origin}/favicon.ico`, method: "GET" }, origin)).toBe("network-only");
  });

  it("reconoce exclusivamente ventanas operativas", () => {
    expect(isOperationalPath("/live")).toBeTrue();
    expect(isOperationalPath("/output/main")).toBeTrue();
    expect(isOperationalPath("/output/stage")).toBeTrue();
    expect(isOperationalPath("/output/stream")).toBeTrue();
    expect(isOperationalPath("/settings")).toBeFalse();
    expect(blockingOperationalPaths([
      { id: "requester", url: `${origin}/settings` },
      { id: "live", url: `${origin}/live` },
      { id: "stage", url: `${origin}/output/stage` },
      { id: "project", url: `${origin}/projects` },
    ], "requester")).toEqual(["/live", "/output/stage"]);
  });
});

describe("PWA static contract", () => {
  it("mantiene el manifest, registro manual y actualización sin auto reload", async () => {
    const config = await Bun.file("vite.config.ts").text();
    const runtime = await Bun.file("src/features/pwa/pwa-context.tsx").text();
    const worker = await Bun.file("src/pwa/sw.ts").text();
    expect(config).toContain('name: "Presenter El Encuentro"');
    expect(config).toContain('strategies: "injectManifest"');
    expect(config).toContain("injectRegister: false");
    expect(runtime).toContain('navigator.serviceWorker.register("/sw.js"');
    expect(runtime).toContain("import.meta.env.PROD");
    expect(runtime).toContain('addEventListener("controllerchange"');
    expect(runtime).toContain("{ once: true }");
    expect(worker).not.toContain("clientsClaim(");
    expect(worker).toContain('data?.type === "SKIP_WAITING"');
    expect(worker).toContain('data.type === "SKIP_WAITING" && blocked.length === 0');
    expect(worker).toContain("cleanupOutdatedCaches()");
    expect(worker).not.toContain("application-migrations");
    expect(config).toContain('"/output/main", "/output/stage", "/output/stream"');
  });

  it("incluye iconos PNG con las dimensiones declaradas", async () => {
    const dimensions = async (path: string) => {
      const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return [view.getUint32(16), view.getUint32(20)];
    };
    expect(await dimensions("public/icons/pwa-192x192.png")).toEqual([192, 192]);
    expect(await dimensions("public/icons/pwa-512x512.png")).toEqual([512, 512]);
    expect(await dimensions("public/icons/pwa-maskable-512x512.png")).toEqual([512, 512]);
    expect(await dimensions("public/icons/apple-touch-icon.png")).toEqual([180, 180]);
  });
});
