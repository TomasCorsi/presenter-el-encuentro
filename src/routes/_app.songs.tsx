import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SongsProvider } from "@/features/songs/songs-context";

export const Route = createFileRoute("/_app/songs")({
  component: SongsLayout,
});

function SongsLayout() {
  return (
    <SongsProvider>
      <Outlet />
    </SongsProvider>
  );
}
