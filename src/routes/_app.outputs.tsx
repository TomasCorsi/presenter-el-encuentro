import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Outputs — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Salidas de pantalla: main, stage y stream, cada una con su propio diseño.";

export const Route = createFileRoute("/_app/outputs")({
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
  component: OutputsPage,
});

function OutputsPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Producción"
        title="Outputs"
        description="Pantallas de salida: main, stage y stream."
      />
      <EmptyState
        icon={Clapperboard}
        title="Sin salidas configuradas"
        description="La salida principal llega en la Fase 6; stage y stream en la Fase 10."
      />
    </Page>
  );
}
