import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

const TITLE = "Live — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Modo de operación en directo: rundown, preview, program y controles de presentación.";

export const Route = createFileRoute("/_app/live")({
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
  component: LivePage,
});

function LivePage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Producción"
        title="Live"
        description="Rundown, preview, program y controles de presentación."
        actions={<StatusBadge tone="neutral">Disponible en Fase 5</StatusBadge>}
      />
      <EmptyState
        icon={Radio}
        title="Modo en directo no disponible"
        description="El motor de presentación llega en la Fase 4 y el modo en directo en la Fase 5."
        className="border-l-2 border-l-primary/60"
      />
    </Page>
  );
}
