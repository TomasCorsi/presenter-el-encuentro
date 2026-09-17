import { ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

export interface LiveShowBarProps {
  showName: string;
  itemCount: number;
  /** El contenido de origen cambió desde que se cargó el snapshot. */
  outdated: boolean;
  /** Nombre del Project activo cuando difiere del show cargado. */
  activeProjectName: string | null;
  onReload(): void;
  onLoadActiveProject(): void;
}

/**
 * Barra de show: identifica el snapshot en operación y ofrece las dos únicas
 * recargas posibles, siempre explícitas (ADR-023).
 */
export function LiveShowBar({
  showName,
  itemCount,
  outdated,
  activeProjectName,
  onReload,
  onLoadActiveProject,
}: LiveShowBarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
        <span className="truncate text-sm font-semibold text-foreground">{showName}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {itemCount} elementos
        </span>
        {outdated ? <StatusBadge tone="sync">Contenido actualizado</StatusBadge> : null}
        <Button variant="outline" size="sm" className="ml-auto" onClick={onReload}>
          <RefreshCw />Recargar presentación
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/output/main", "_blank", "noopener")}
        >
          <ExternalLink />Abrir Output
        </Button>
      </div>

      {activeProjectName ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          <span>El proyecto activo cambió a «{activeProjectName}».</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={onLoadActiveProject}>
            Cargar este proyecto
          </Button>
        </div>
      ) : null}
    </div>
  );
}
