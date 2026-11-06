// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

const buildRevision = process.env["SOURCE_VERSION"] ?? process.env["GITHUB_SHA"] ?? `${Date.now()}`;
// Operational route audit: "/output/main", "/output/stage", "/output/stream".

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      outDir: ".output/public",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "icons/*.png", "robots.txt"],
      manifest: {
        name: "Presenter El Encuentro",
        short_name: "Presenter",
        description: "Entorno local-first para preparar y operar presentaciones en vivo.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0A0C10",
        background_color: "#0A0C10",
        icons: [
          { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        // prettier-ignore -- static contract keeps the operational route group auditable.
        additionalManifestEntries: [
          "/",
          "/projects",
          "/songs",
          "/bible",
          "/media",
          "/presets",
          "/live",
          "/outputs",
          "/settings",
          "/output/main",
          "/output/stage",
          "/output/stream",
        ].map((url) => ({ url, revision: buildRevision })),
      },
    }),
  ],
  vite: {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildRevision),
      __APP_VERSION__: JSON.stringify("Fase 15"),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
