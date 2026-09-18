import { ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { OutputWindowStatus } from "@/features/output/use-output-window";

export interface LiveShowBarProps {
  showName: string;
  itemCount: number;
  /** El contenido de origen cambió desde que se cargó el snapshot. */
  outdated: boolean;
  /** Nombre del Project activo cuando difiere del show cargado. */
  activeProjectName: string | null;
  /** Estado real de la ventana de salida. */
  outputStatus: OutputWindowStatus;
  /** Aviso sobre la salida; `null` cuando no hay nada que explicar. */
  outputMessage: string | null;
  onReload(): void;
  onLoadActiveProject(): void;
  onOpenOutput(): void;
}

const OUTPUT_LABEL: Record<OutputWindowStatus, string> = {
  closed: "Output cerrado",
  open: "Output abierto",
  blocked: "Output bloqueado",
  unidentified: "Proyector no identificado",
  disconnected: "Proyector desconectado",
};

const OUTPUT_TONE: Record<OutputWindowStatus, StatusTone> = {
  closed: "neutral",
  open: "online",
  blocked: "offline",
  unidentified: "sync",
  disconnected: "offline",
};

/**
 * Barra de show: identifica el snapshot en operación, informa el estado de la
 * ventana de salida y ofrece las dos únicas recargas posibles, siempre
 * explícitas (ADR-023).
 */
export function LiveShowBar({
  showName,
  itemCount,
  outdated,
  activeProjectName,
  outputStatus,
  outputMessage,
  onReload,
  onLoadActiveProject,
  onOpenOutput,
}: LiveShowBarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
        <span className="truncate text-sm font-semibold text-foreground">{showName}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {itemCount} elementos
        </span>
        {outdated ? <StatusBadge tone="sync">Contenido actualizado</StatusBadge> : null}
        <StatusBadge tone={OUTPUT_TONE[outputStatus]}>{OUTPUT_LABEL[outputStatus]}</StatusBadge>
        <Button variant="outline" size="sm" className="ml-auto" onClick={onReload}>
          <RefreshCw />Recargar presentación
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenOutput}>
          <ExternalLink />Abrir Output
        </Button>
      </div>

      {outputMessage ? (
        <p role="status" className="text-sm text-muted-foreground">
          {outputMessage}
        </p>
      ) : null}

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
