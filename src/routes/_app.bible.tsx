import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Bible — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Consulta de versiones, libros, capítulos y versículos para proyectar durante el servicio.";

export const Route = createFileRoute("/_app/bible")({
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
  component: BiblePage,
});

function BiblePage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Contenido"
        title="Bible"
        description="Versiones, libros, capítulos y versículos."
      />
      <EmptyState
        icon={BookOpen}
        title="Sin versiones descargadas"
        description="La navegación bíblica, la búsqueda y la proyección llegan en la Fase 8."
      />
    </Page>
  );
}
