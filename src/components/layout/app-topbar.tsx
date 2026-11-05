import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { USER_PLACEHOLDER, WORKSPACE_PLACEHOLDER } from "@/components/layout/shell-placeholders";
import { useProjects } from "@/features/projects/projects-context";
import { usePwa } from "@/features/pwa/pwa-context";
import { useCloud } from "@/features/cloud/cloud-context";
import { useSync } from "@/features/sync/sync-context";

/**
 * Barra superior del App Shell.
 * Reserva el espacio para workspace, proyecto activo, conexión y perfil.
 * Sin lógica real en esta fase.
 */
export function AppTopbar() {
  const { activeProject, loading } = useProjects();
  const { network, update } = usePwa();
  const cloud = useCloud();
  const sync = useSync();
  const cloudInitials = cloud.user?.email
    ?.split("@", 1)[0]
    ?.split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const projectName = loading ? "Cargando…" : (activeProject?.name ?? "Sin proyecto activo");
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-5">
      <SidebarTrigger className="size-8 shrink-0 rounded-sm border border-transparent hover:border-border" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
          {WORKSPACE_PLACEHOLDER.name}
        </span>
        <ChevronRight aria-hidden="true" className="hidden size-3.5 text-border sm:block" />
        <span className="hidden truncate text-sm font-medium text-foreground sm:inline">
          {projectName}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {sync.status === "conflict" || sync.status === "error" ? (
          <Link to="/settings" aria-label="Revisar sincronización">
            <StatusBadge tone="offline">
              {sync.status === "conflict" ? "Conflictos" : "Error sync"}
            </StatusBadge>
          </Link>
        ) : null}
        {update !== "current" ? (
          <Link to="/settings" aria-label="Ver actualización disponible">
            <StatusBadge tone="sync">Actualizar</StatusBadge>
          </Link>
        ) : null}
        <StatusBadge tone={network === "online" ? "online" : "offline"}>
          {network === "online" ? "Con red" : "Sin red"}
        </StatusBadge>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <Button asChild variant="ghost" size="icon" className="size-8 rounded-sm p-0">
          <Link
            to="/settings"
            aria-label={`Perfil de ${cloud.user?.email ?? USER_PLACEHOLDER.name}`}
          >
            <Avatar className="size-8 rounded-sm border border-border">
              <AvatarFallback className="rounded-sm bg-muted font-mono text-[11px] text-foreground">
                {cloudInitials || USER_PLACEHOLDER.initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </Button>
      </div>
    </header>
  );
}
