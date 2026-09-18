import { createFileRoute } from "@tanstack/react-router";

import { Page, PageHeader } from "@/components/layout/page";
import { AudienceScreenSettings } from "@/features/display/components/audience-screen-settings";

const TITLE = "Settings — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Preferencias del workspace: pantalla del proyector, apariencia y opciones del entorno.";

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
        description="Preferencias del puesto de trabajo y del entorno."
      />
      <AudienceScreenSettings />
    </Page>
  );
}
