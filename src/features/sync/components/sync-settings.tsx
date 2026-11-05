import { RefreshCw, Unlink, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCloud } from "@/features/cloud/cloud-context";
import { useSync } from "@/features/sync/sync-context";

const labels = {
  disabled: "Desactivado",
  idle: "Al día",
  syncing: "Sincronizando",
  offline: "Sin red",
  error: "Error",
  conflict: "Conflictos",
} as const;

export function SyncSettings() {
  const sync = useSync();
  const cloud = useCloud();
  const totals =
    sync.assessment &&
    Object.values(sync.assessment.counts).reduce(
      (sum, item) => ({
        local: sum.local + item.local,
        cloud: sum.cloud + item.cloud,
        collisions: sum.collisions + item.collisions,
        tombstones: sum.tombstones + item.tombstones,
      }),
      { local: 0, cloud: 0, collisions: 0, tombstones: 0 },
    );
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="size-4 text-primary" />
          Sincronización
        </CardTitle>
        <CardDescription>
          Projects, Songs y presets de usuario. Media y Bible no se transfieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            tone={
              sync.status === "idle"
                ? "online"
                : sync.status === "error" || sync.status === "conflict"
                  ? "offline"
                  : "neutral"
            }
          >
            {labels[sync.status]}
          </StatusBadge>
          <StatusBadge tone="neutral">{sync.pendingCount} pendientes</StatusBadge>
          <StatusBadge tone={sync.conflictsCount ? "offline" : "neutral"}>
            {sync.conflictsCount} conflictos
          </StatusBadge>
        </div>
        {sync.link ? (
          <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-5">
            <p>Usuario: {cloud.user?.email ?? sync.link.userId}</p>
            <p>Workspace: {cloud.identity?.workspace.name ?? sync.link.cloudWorkspaceId}</p>
            <p>
              Última sincronización:{" "}
              {sync.link.lastSyncAt
                ? new Date(sync.link.lastSyncAt).toLocaleString()
                : "Todavía no completó"}
            </p>
          </div>
        ) : null}
        {totals ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-5">
            <p>
              Local: {totals.local} · Cloud: {totals.cloud} · Colisiones: {totals.collisions} ·
              Tombstones: {totals.tombstones}
            </p>
            {sync.assessment
              ? Object.entries(sync.assessment.counts).map(([type, counts]) => (
                  <p key={type}>
                    {type}: {counts.local} local · {counts.cloud} cloud · {counts.onlyLocal} sólo
                    local · {counts.onlyCloud} sólo cloud · {counts.collisions} colisiones
                  </p>
                ))
              : null}
            <p>
              Se unirán IDs distintos. Las colisiones quedarán aisladas para resolución manual.
              Media no se transfiere.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!sync.link ? (
            <Button
              size="sm"
              disabled={cloud.auth !== "authenticated"}
              onClick={() => void sync.assessLink()}
            >
              Vincular datos locales
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => void sync.syncNow()}>
                <RefreshCw />
                Sync now
              </Button>
              {sync.errorCount || sync.link.state === "paused" ? (
                <Button size="sm" variant="outline" onClick={() => void sync.retryErrors()}>
                  Retry errors
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void sync.unlink()}>
                <Unlink />
                Desvincular dispositivo
              </Button>
            </>
          )}
          {sync.assessment ? (
            <Button size="sm" onClick={() => void sync.confirmLink()}>
              Confirmar vínculo
            </Button>
          ) : null}
        </div>
        {sync.conflicts.map((conflict) => (
          <div
            key={conflict.key}
            className="space-y-2 rounded-md border border-offline/30 p-3 text-xs"
          >
            <p className="font-medium">
              {conflict.entityType} · {conflict.entityId} · {conflict.kind}
            </p>
            <p>
              Detectado: {new Date(conflict.detectedAt).toLocaleString()} · revisión cloud:{" "}
              {conflict.cloud?.revision ?? "sin fila"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void sync.resolve(conflict, "keep-local")}
              >
                Mantener local
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void sync.resolve(conflict, "use-cloud")}
              >
                Usar cloud
              </Button>
              {conflict.localSnapshot ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void sync.resolve(conflict, "duplicate-local")}
                >
                  Duplicar mi versión y usar cloud
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {sync.error ? (
          <p role="alert" className="text-xs text-offline-foreground">
            {sync.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
