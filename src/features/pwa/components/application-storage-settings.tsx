import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, HardDrive, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useLocalData } from "@/features/local-data/local-data-context";
import { useMedia } from "@/features/media/media-context";
import { usePwa } from "@/features/pwa/pwa-context";
import {
  readStorageEstimate,
  requestStoragePersistenceOnce,
  storagePersistenceStatus,
  storagePersistenceWasRequested,
  type StorageEstimate,
  type StoragePersistenceStatus,
} from "@/services/media/storage-persistence";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

const persistenceLabel: Record<StoragePersistenceStatus, string> = {
  persistent: "Persistente",
  "not-persistent": "Best effort",
  unsupported: "No soportado",
};

export function ApplicationStorageSettings() {
  const pwa = usePwa();
  const localData = useLocalData();
  const media = useMedia();
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [persistence, setPersistence] = useState<StoragePersistenceStatus | null>(media.persistenceStatus);
  const [persistenceAttempted, setPersistenceAttempted] = useState(false);

  const refreshStorage = async () => {
    const [nextPersistence, nextEstimate] = await Promise.all([
      storagePersistenceStatus(),
      readStorageEstimate(),
    ]);
    setPersistence(nextPersistence);
    setEstimate(nextEstimate);
  };

  useEffect(() => {
    setPersistenceAttempted(storagePersistenceWasRequested());
    void refreshStorage();
  }, []);

  const quotaPercent = useMemo(() => {
    if (!estimate || estimate.quotaBytes <= 0) return null;
    return Math.round((estimate.usageBytes / estimate.quotaBytes) * 100);
  }, [estimate]);

  const requestPersistence = async () => {
    setPersistence(await requestStoragePersistenceOnce());
    setPersistenceAttempted(true);
    setEstimate(await readStorageEstimate());
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4 text-primary" />
          Aplicación y almacenamiento
        </CardTitle>
        <CardDescription>
          Instalación, actualización segura y estado del almacenamiento local de este dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Aplicación</span>
              <StatusBadge tone={pwa.install === "installed" ? "online" : "neutral"}>
                {pwa.install === "installed" ? "Instalada" : "Navegador"}
              </StatusBadge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Versión: {pwa.version}</p>
            {pwa.install === "available" ? (
              <Button size="sm" className="mt-3" onClick={() => void pwa.installApplication()}>
                <Download /> Instalar
              </Button>
            ) : pwa.install === "unavailable" ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Si el navegador lo permite, instalala desde su menú de aplicaciones.
              </p>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Actualización</span>
              <StatusBadge tone={pwa.update === "current" ? "online" : pwa.update === "error" ? "offline" : "sync"}>
                {pwa.update === "current" ? "Actual" : pwa.update === "blocked" ? "Bloqueada" : pwa.update === "applying" ? "Aplicando" : pwa.update === "error" ? "Error" : "Disponible"}
              </StatusBadge>
            </div>
            {pwa.update !== "current" && pwa.update !== "applying" ? (
              <Button size="sm" variant="outline" onClick={() => void pwa.applyUpdate()}>
                <RefreshCw /> Aplicar actualización
              </Button>
            ) : null}
            {pwa.update === "blocked" ? (
              <p className="mt-2 text-xs leading-5 text-warning">
                Cerrá las ventanas operativas antes de actualizar: {pwa.blockedPaths.join(", ")}.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-border bg-background/40 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium"><Database className="size-4" /> Datos locales</h3>
              <p className="mt-1 text-xs text-muted-foreground">IndexedDB principal y migraciones legacy.</p>
            </div>
            <StatusBadge tone={localData.database === "ready" ? "online" : "sync"}>
              {localData.database === "ready" ? "Disponible" : "Degradado"}
            </StatusBadge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {localData.migrations.map((migration) => (
              <div key={migration.domain} className="rounded border border-border px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium capitalize">
                  {migration.state === "complete" ? <CheckCircle2 className="size-3.5 text-success" /> : <AlertTriangle className="size-3.5 text-warning" />}
                  {migration.domain}
                </div>
                <p className="mt-1 text-muted-foreground">{migration.state === "complete" ? `${migration.count} registros · ${migration.source}` : migration.warning}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-border bg-background/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Persistencia y cuota</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {persistence ? persistenceLabel[persistence] : "Consultando…"} · Media: {media.storageKind === "opfs" ? "OPFS" : media.storageKind === "indexeddb-blob" ? "IndexedDB (sólo imágenes)" : "Memoria temporal"}
              </p>
              {estimate ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {formatBytes(estimate.usageBytes)} de {formatBytes(estimate.quotaBytes)}{quotaPercent === null ? "" : ` · ${quotaPercent}%`}
                </p>
              ) : null}
              {quotaPercent !== null && quotaPercent >= 80 ? (
                <p className="mt-1 text-xs text-warning">El almacenamiento está cerca de su límite.</p>
              ) : null}
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                La persistencia reduce el riesgo de limpieza automática del navegador; no reemplaza un backup.
              </p>
            </div>
            {persistence === "not-persistent" && !persistenceAttempted ? (
              <Button size="sm" variant="outline" onClick={() => void requestPersistence()}>
                Solicitar persistencia
              </Button>
            ) : null}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
