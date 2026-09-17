import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsLayout,
});

/**
 * Layout de Projects. Los providers de datos viven en el App Shell (`_app`)
 * para que no se remonten al navegar entre secciones (ADR-031).
 */
function ProjectsLayout() {
  return <Outlet />;
}
