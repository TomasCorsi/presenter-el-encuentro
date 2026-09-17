import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/presets")({
  component: PresetsLayout,
});

/**
 * Layout de Presets. Los providers de datos viven en el App Shell (`_app`)
 * para que no se remonten al navegar entre secciones (ADR-031).
 */
function PresetsLayout() {
  return <Outlet />;
}
