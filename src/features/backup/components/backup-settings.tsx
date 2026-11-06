import { useEffect, useRef, useState } from "react";
import { ArchiveRestore, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBackup } from "../backup-context";

function bytes(value: number): string {
  if (value < 1024 ** 2) return `${Math.ceil(value / 1024)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

export function BackupSettings() {
  const backup = useBackup();
  const [confirm, setConfirm] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const percent =
    backup.progress && backup.progress.totalItems > 0
      ? Math.round((backup.progress.completedItems / backup.progress.totalItems) * 100)
      : 0;
  useEffect(() => {
    void backup.refreshInventory().catch(() => undefined);
    // Inventory is intentionally refreshed when Settings mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArchiveRestore className="size-4 text-primary" /> Backup y Restore local
        </CardTitle>
        <CardDescription>
          Exporta Projects, Songs, Presets, Media, Bible y preferencias. Sync, cuenta cloud y estado
          de Live no se incluyen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {backup.inventory ? (
          <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Resumen local</p>
            <p>
              {backup.inventory.counts.projects} projects · {backup.inventory.counts.songs} songs ·{" "}
              {backup.inventory.counts.presets} presets · {backup.inventory.counts.mediaAssets}{" "}
              media · {backup.inventory.counts.bibleVersions} Biblias
            </p>
            <p>
              Completo estimado: {bytes(backup.inventory.estimatedBytes)} · Sin Media:{" "}
              {bytes(backup.inventory.structuredBytes)} ·{" "}
              {"showSaveFilePicker" in window
                ? "Destino streaming compatible"
                : "Fallback Blob hasta 512 MiB"}
            </p>
            {backup.inventory.missingMediaIds.length ? (
              <p className="text-warning">
                {backup.inventory.missingMediaIds.length} archivos Media faltantes: usá backup sin
                Media.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={backup.busy}
            onClick={() => void backup.createBackup("complete").catch(() => undefined)}
          >
            <Download /> Backup completo
          </Button>
          <Button
            disabled={backup.busy}
            variant="outline"
            onClick={() => void backup.createBackup("without-media").catch(() => undefined)}
          >
            Sin archivos Media
          </Button>
          <Button
            disabled={backup.busy}
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            <Upload /> Inspeccionar backup
          </Button>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            accept=".presenterbackup,application/vnd.presenter-el-encuentro.backup+zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void backup.inspect(file);
              event.target.value = "";
            }}
          />
        </div>
        {backup.lastBackupAt ? (
          <p className="text-xs text-muted-foreground">
            Último backup correcto: {new Date(backup.lastBackupAt).toLocaleString("es")}
          </p>
        ) : null}
        {backup.busy && backup.progress ? (
          <div className="space-y-2">
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">{backup.progress.message}</p>
          </div>
        ) : null}
        {backup.busy && backup.progress?.phase !== "commit" ? (
          <Button size="sm" variant="ghost" onClick={backup.cancel}>
            Cancelar operación
          </Button>
        ) : null}
        {backup.error ? (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {backup.error}
          </p>
        ) : null}
        {backup.inspection ? (
          <section className="space-y-3 rounded-md border border-border p-3 text-sm">
            <div>
              <p className="font-medium">{backup.inspection.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {backup.inspection.manifest.backupType === "complete" ? "Completo" : "Sin Media"} ·{" "}
                {backup.inspection.manifest.counts.projects} projects ·{" "}
                {backup.inspection.manifest.counts.songs} songs ·{" "}
                {backup.inspection.manifest.counts.mediaAssets} media
              </p>
              <p className="text-xs text-muted-foreground">
                Espacio temporal requerido: {bytes(backup.inspection.requiredAdditionalBytes)}
                {backup.inspection.quotaAvailableBytes === null
                  ? " · cuota no disponible"
                  : ` · disponible ${bytes(backup.inspection.quotaAvailableBytes)}`}
              </p>
            </div>
            <p className="text-xs text-warning">
              Restore reemplaza todos los datos locales, cierra la sesión cloud local y recarga la
              aplicación. No combina contenido.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
              />{" "}
              Confirmo el reemplazo total.
            </label>
            <div className="flex gap-2">
              <Button
                disabled={backup.busy || !confirm || backup.inspection.quotaSufficient === false}
                variant="destructive"
                onClick={() => void backup.restore().catch(() => undefined)}
              >
                Restaurar y reemplazar
              </Button>
              <Button disabled={backup.busy} variant="ghost" onClick={backup.clearInspection}>
                Cancelar
              </Button>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
