import { ExternalLink, Maximize, Minimize, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { ProgramMode } from "@/domain/presentation/presentation";
import type { OutputWindowStatus } from "@/features/output/use-output-window";
import { cn } from "@/lib/utils";

import { LiveControls } from "./live-controls";

export interface LiveOperatorToolbarProps {
  showName: string;
  itemCount: number;
  outdated: boolean;
  activeProjectName: string | null;
  outputStatus: OutputWindowStatus;
  outputMessage: string | null;
  fullscreenSupported: boolean;
  fullscreen: boolean;
  fullscreenError: string | null;
  canPrevious: boolean;
  canNext: boolean;
  canTake: boolean;
  programMode: ProgramMode;
  libraryOpen: boolean;
  compact?: boolean;
  short?: boolean;
  onPrevious(): void;
  onNext(): void;
  onTake(): void;
  onToggleMode(mode: Exclude<ProgramMode, "content">): void;
  onSearch(): void;
  onReload(): void;
  onLoadActiveProject(): void;
  onOpenOutput(): void;
  onToggleFullscreen(): void;
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

/** Una sola barra para identidad del show, operación y acciones de ventana. */
export function LiveOperatorToolbar({
  showName,
  itemCount,
  outdated,
  activeProjectName,
  outputStatus,
  outputMessage,
  fullscreenSupported,
  fullscreen,
  fullscreenError,
  canPrevious,
  canNext,
  canTake,
  programMode,
  libraryOpen,
  compact = false,
  short = false,
  onPrevious,
  onNext,
  onTake,
  onToggleMode,
  onSearch,
  onReload,
  onLoadActiveProject,
  onOpenOutput,
  onToggleFullscreen,
}: LiveOperatorToolbarProps) {
  const statusMessage = fullscreenError ?? outputMessage;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center overflow-hidden rounded-md border border-border bg-card px-2",
        compact ? "min-h-10 gap-1 py-0.5" : "min-h-11 gap-2 py-1",
      )}
      aria-label="Barra de operación Live"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-44 truncate text-sm font-semibold text-foreground">{showName}</span>
        {!short ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {itemCount} items
          </span>
        ) : null}
        {outdated ? (
          <Button variant="outline" size="sm" onClick={onReload} title="Recargar presentación">
            <RefreshCw />
            {!compact ? "Actualizar" : null}
          </Button>
        ) : null}
        {activeProjectName ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadActiveProject}
            title={`Cargar el proyecto activo ${activeProjectName}`}
          >
            Cargar {compact ? "proyecto" : activeProjectName}
          </Button>
        ) : null}
      </div>

      <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />

      <LiveControls
        canPrevious={canPrevious}
        canNext={canNext}
        canTake={canTake}
        programMode={programMode}
        onPrevious={onPrevious}
        onNext={onNext}
        onTake={onTake}
        onToggleMode={onToggleMode}
        compact={compact}
        short={short}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onSearch}
          aria-expanded={libraryOpen}
          aria-controls="live-library-dock"
          title="Buscar en la biblioteca (/)"
        >
          <Search />
          Buscar
        </Button>
        <StatusBadge
          tone={fullscreenError ? "offline" : OUTPUT_TONE[outputStatus]}
          title={statusMessage ?? OUTPUT_LABEL[outputStatus]}
          aria-label={statusMessage ?? OUTPUT_LABEL[outputStatus]}
        >
          {compact
            ? outputStatus === "open"
              ? "Output"
              : OUTPUT_LABEL[outputStatus]
            : OUTPUT_LABEL[outputStatus]}
        </StatusBadge>
        <Button variant="outline" size="sm" onClick={onOpenOutput} title="Abrir Output">
          <ExternalLink />
          {!compact && !short ? "Output" : null}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!fullscreenSupported}
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          title={
            fullscreenSupported
              ? fullscreen
                ? "Salir de pantalla completa"
                : "Pantalla completa"
              : "Este navegador no admite la Fullscreen API"
          }
        >
          {fullscreen ? <Minimize /> : <Maximize />}
          {!compact && !short ? (fullscreen ? "Salir" : "Fullscreen") : null}
        </Button>
      </div>

      {statusMessage ? (
        <span className="sr-only" role="status">
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}
