import { createFileRoute } from "@tanstack/react-router";
import { Music } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Songs — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Biblioteca de canciones con secciones y slides listos para presentar en vivo.";

export const Route = createFileRoute("/_app/songs")({
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
  component: SongsPage,
});

function SongsPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Contenido"
        title="Songs"
        description="Biblioteca de canciones del workspace."
      />
      <EmptyState
        icon={Music}
        title="Biblioteca vacía"
        description="La biblioteca, el editor de secciones y los slides llegan en la Fase 3."
      />
    </Page>
  );
}
