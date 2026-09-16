import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Presets — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Estilos reutilizables de fondo, tipografía, posición y transición para las slides.";

export const Route = createFileRoute("/_app/presets")({
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
  component: PresetsPage,
});

function PresetsPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Apariencia"
        title="Presets"
        description="Estilos de presentación reutilizables."
      />
      <EmptyState
        icon={SlidersHorizontal}
        title="Sin presets"
        description="La biblioteca y el editor de presets llegan en la Fase 7."
      />
    </Page>
  );
}
