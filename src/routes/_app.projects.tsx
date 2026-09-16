import { createFileRoute } from "@tanstack/react-router";
import { LayoutList } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Projects — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Gestión de proyectos y rundowns para servicios, eventos y transmisiones en vivo.";

export const Route = createFileRoute("/_app/projects")({
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
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Producción"
        title="Projects"
        description="Proyectos y rundowns del workspace."
      />
      <EmptyState
        icon={LayoutList}
        title="Sin proyectos todavía"
        description="La gestión de proyectos, el rundown y la persistencia local llegan en la Fase 2."
      />
    </Page>
  );
}
