import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bible")({
  component: BibleLayout,
});

/**
 * Layout de Bible. El provider vive en el App Shell (`_app`) para no
 * remontarse al navegar entre secciones (ADR-031).
 */
function BibleLayout() {
  return <Outlet />;
}
