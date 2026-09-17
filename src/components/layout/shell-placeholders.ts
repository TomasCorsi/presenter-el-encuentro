import type { StatusTone } from "@/components/ui/status-badge";

/**
 * Datos visuales de marcador de posición para el App Shell (Fase 1).
 * No representan estado real: la sincronización llega en fases posteriores.
 */
export interface ConnectionStatus {
  readonly tone: Extract<StatusTone, "online" | "offline" | "sync">;
  readonly label: string;
}

export const WORKSPACE_PLACEHOLDER = {
  name: "Workspace",
  plan: "Local",
} as const;

export const USER_PLACEHOLDER = {
  name: "Usuario",
  email: "usuario@local",
  initials: "US",
} as const;

export const CONNECTION_PLACEHOLDER: ConnectionStatus = {
  tone: "offline",
  label: "Offline",
};
