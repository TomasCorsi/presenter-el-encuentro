import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "live" | "online" | "offline" | "sync" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  live: "border-live/40 bg-live/15 text-live",
  online: "border-success/40 bg-success/15 text-success",
  offline: "border-offline/40 bg-offline/15 text-offline-foreground",
  sync: "border-warning/40 bg-warning/15 text-warning",
  neutral: "border-border bg-muted text-muted-foreground",
};

const dotClasses: Record<StatusTone, string> = {
  live: "bg-live",
  online: "bg-success",
  offline: "bg-offline",
  sync: "bg-warning",
  neutral: "bg-muted-foreground",
};

export interface StatusBadgeProps extends ComponentProps<"span"> {
  /** Tono semántico del estado. */
  tone?: StatusTone;
  /** Muestra el punto indicador a la izquierda. */
  showDot?: boolean;
  /** Anima el punto: solo para estados activos (LIVE, sincronizando). */
  pulse?: boolean;
}

/**
 * Distintivo de estado del sistema (LIVE, Online, Offline, Sync).
 * Componente puramente visual: no consulta ningún estado real.
 */
export function StatusBadge({
  tone = "neutral",
  showDot = true,
  pulse = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5",
        "font-mono text-[11px] font-medium uppercase tracking-wider",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            dotClasses[tone],
            pulse && "animate-pulse",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
