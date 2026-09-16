import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";

const TITLE = "Settings — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Preferencias del workspace, apariencia y opciones del entorno de producción.";

export const Route = createFileRoute("/_app/settings")({
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
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Page width="contained">
      <PageHeader
        eyebrow="Sistema"
        title="Settings"
        description="Preferencias del workspace y del entorno."
      />
      <EmptyState
        icon={Settings}
        title="Sin opciones disponibles"
        description="Las preferencias reales aparecen cuando cada módulo del producto se construya."
      />
    </Page>
  );
}
