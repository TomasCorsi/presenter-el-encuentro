import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BibleProvider } from "@/features/bible/bible-context";
import { PresentationProvider } from "@/features/presentation/presentation-context";
import { PresetsProvider } from "@/features/presets/presets-context";
import { ProjectsProvider } from "@/features/projects/projects-context";
import { SongsProvider } from "@/features/songs/songs-context";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

/**
 * App Shell: sidebar + topbar + área de contenido con scroll propio.
 * Las rutas de output (/output/*) y /remote no se montan bajo este layout.
 *
 * Los providers de datos viven aquí y solo aquí: montarlos por ruta los
 * remontaría en cada navegación (ADR-031).
 */
function AppShell() {
  return (
    <ProjectsProvider>
      <SongsProvider>
        <PresetsProvider>
          <BibleProvider>
            {/* El motor de presentación también vive en el shell: montarlo en
                la ruta /live lo remontaría y lo expondría a duplicados de
                módulo al dividirse el bundle de la ruta. */}
            <PresentationProvider>
              <SidebarProvider>
                {/* Altura fija de viewport: el scroll vive dentro de <main>,
                    nunca en la ventana (la consola de Live no debe desplazarse). */}
                <div className="flex h-screen w-full overflow-hidden bg-background">
                  <AppSidebar />
                  <SidebarInset className="flex min-w-0 flex-1 flex-col bg-background">
                    <AppTopbar />
                    <main className="min-w-0 flex-1 overflow-y-auto">
                      <Outlet />
                    </main>
                  </SidebarInset>
                </div>
              </SidebarProvider>
            </PresentationProvider>
          </BibleProvider>
        </PresetsProvider>
      </SongsProvider>
    </ProjectsProvider>
  );
}
