import { Link, createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Radio, Settings } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import {
  ACTIVE_PROJECT_PLACEHOLDER,
  CONNECTION_PLACEHOLDER,
} from "@/components/layout/shell-placeholders";
import { ProductionShortcut } from "@/components/ui/production-shortcut";
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
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const projects = items.find((item) => item.to === "/projects");
  const live = items.find((item) => item.to === "/live");
  const tools = items.filter((item) =>
    ["/songs", "/bible", "/media", "/presets", "/outputs"].includes(item.to),
  );

  if (!projects || !live) return null;

  return (
    <Page>
      <PageHeader
        eyebrow="Production Center"
        title="Centro de producción"
        description="Acceso central al workspace y a las herramientas de presentación."
      />

      <section aria-labelledby="main-actions-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="main-actions-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acciones principales
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ProductionShortcut
            title={projects.title}
            description="Organiza el contenido de una producción"
            to={projects.to}
            icon={projects.icon}
            variant="primary"
          />
          <ProductionShortcut
            title={live.title}
            description="Accede al entorno de presentación en directo"
            to={live.to}
            icon={live.icon}
            variant="primary"
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="tools-title">
          <h2 id="tools-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Herramientas de producción
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {tools.map((tool) => (
              <ProductionShortcut
                key={tool.to}
                title={tool.title}
                description="Abrir sección"
                to={tool.to}
                icon={tool.icon}
              />
            ))}
          </div>
        </section>

        <aside aria-labelledby="context-title">
          <h2 id="context-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contexto actual
          </h2>
          <div className="rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground">
                <FolderOpen className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Proyecto activo</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{ACTIVE_PROJECT_PLACEHOLDER}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-muted-foreground">Conexión</span>
              <StatusBadge tone={CONNECTION_PLACEHOLDER.tone}>{CONNECTION_PLACEHOLDER.label}</StatusBadge>
            </div>
          </div>
          <ProductionShortcut
            title="Settings"
            description="Preferencias del entorno"
            to="/settings"
            icon={Settings}
            variant="tertiary"
            className="mt-2"
          />
        </aside>
      </div>
    </Page>
  );
}
