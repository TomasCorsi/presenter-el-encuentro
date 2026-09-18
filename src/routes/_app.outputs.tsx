import { Link, createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
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
        title="Salida principal en uso"
        description="La salida principal se abre desde Live. Elegí en qué pantalla se muestra desde Settings; stage y stream llegan más adelante."
        actions={
          <Button asChild variant="outline">
            <Link to="/settings">Configurar pantalla del proyector</Link>
          </Button>
        }
      />
    </Page>
  );
}
