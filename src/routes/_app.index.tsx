import { Link, createFileRoute } from "@tanstack/react-router";

import { Page, PageHeader } from "@/components/layout/page";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import { StatusBadge } from "@/components/ui/status-badge";

const TITLE = "Home — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Panel principal del entorno de producción: acceso a proyectos, canciones, biblia, medios, presets y salidas.";

export const Route = createFileRoute("/_app/")({
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
  component: HomePage,
});

function HomePage() {
  const sections = NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => item.to !== "/",
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Fase 1 — App Shell"
        title="Centro de producción"
        description="La estructura de la aplicación está lista. Cada sección se construye en su propia fase."
        actions={<StatusBadge tone="neutral">Preview</StatusBadge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                <section.icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {section.title}
                </p>
                <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {section.to}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
