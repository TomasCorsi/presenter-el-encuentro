import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Plataforma de Presentación en Vivo — Fase 0";
const DESCRIPTION =
  "Base técnica y documentación de una plataforma web de presentación en vivo para iglesias, eventos y transmisiones.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/**
 * Placeholder técnico de la Fase 0.
 * El App Shell real (sidebar, topbar, navegación) se construye en la Fase 1.
 */
function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Fase 0 — Arquitectura y documentación
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Plataforma de presentación en vivo
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Base técnica establecida. La documentación del proyecto vive en la
          carpeta <code className="text-foreground">docs/</code> y es la fuente
          de verdad. La interfaz del producto comienza en la Fase 1.
        </p>
        <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
          <li>Documentación revisada y sin contradicciones.</li>
          <li>Arquitectura y regla de dependencias definidas.</li>
          <li>Decisiones registradas (ADR-001 a ADR-010).</li>
          <li>Sin backend, sin PWA y sin almacenamiento local todavía.</li>
        </ul>
      </div>
    </main>
  );
}
