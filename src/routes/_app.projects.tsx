import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SongsProvider } from "@/features/songs/songs-context";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return (
    <SongsProvider>
      <Outlet />
    </SongsProvider>
  );
}
