import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProjectsProvider } from "@/features/projects/projects-context";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

/**
 * App Shell: sidebar + topbar + área de contenido con scroll propio.
 * Las rutas de output (/output/*) y /remote no se montan bajo este layout.
 */
function AppShell() {
  return (
    <ProjectsProvider>
            <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex min-w-0 flex-1 flex-col bg-background">
            <AppTopbar />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
          </ProjectsProvider>
  );
}
