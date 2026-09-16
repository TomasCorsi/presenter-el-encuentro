import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ACTIVE_PROJECT_PLACEHOLDER,
  CONNECTION_PLACEHOLDER,
  USER_PLACEHOLDER,
  WORKSPACE_PLACEHOLDER,
} from "@/components/layout/shell-placeholders";

/**
 * Barra superior del App Shell.
 * Reserva el espacio para workspace, proyecto activo, conexión y perfil.
 * Sin lógica real en esta fase.
 */
export function AppTopbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">
          {WORKSPACE_PLACEHOLDER.name}
        </span>
        <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
          /
        </span>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">
          {ACTIVE_PROJECT_PLACEHOLDER}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={CONNECTION_PLACEHOLDER.tone}>
          {CONNECTION_PLACEHOLDER.label}
        </StatusBadge>
        <button
          type="button"
          aria-label={`Perfil de ${USER_PLACEHOLDER.name}`}
          className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[11px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {USER_PLACEHOLDER.initials}
        </button>
      </div>
    </header>
  );
}
