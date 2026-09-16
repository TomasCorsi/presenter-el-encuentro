import { createFileRoute } from "@tanstack/react-router";
import { Image } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Media — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Imágenes, vídeos, audio y logos disponibles para la presentación, preparados para uso sin conexión.";

export const Route = createFileRoute("/_app/media")({
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
  component: MediaPage,
});

function MediaPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Contenido"
        title="Media"
        description="Imágenes, vídeos, audio y logos."
      />
      <EmptyState
        icon={Image}
        title="Sin medios"
        description="La biblioteca de medios, miniaturas y metadatos llegan en la Fase 9."
      />
    </Page>
  );
}
