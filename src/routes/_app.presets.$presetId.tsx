import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, SlidersHorizontal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRESET_NAME_MAX_LENGTH, isDefaultPresetId, type Preset } from "@/domain/presets/preset";
import { findPresetUsage } from "@/domain/presets/preset-resolution";
import { PresetStyleForm } from "@/features/presets/components/preset-style-form";
import { usePresets } from "@/features/presets/presets-context";
import { useProjects } from "@/features/projects/projects-context";
import { SlideRenderer } from "@/features/presentation/components/slide-renderer";

const TITLE = "Editor de preset — Plataforma de presentación en vivo";
const DESCRIPTION = "Ajuste de tipografía, alineación, color, fondo y safe area con vista previa 16:9.";
const AUTOSAVE_DELAY_MS = 600;

/** Contenido de ejemplo propio: nunca letras reales de canciones. */
const SAMPLE_LINES = [
  "Esta es una vista previa del texto",
  "con varias líneas de ejemplo",
  "para comprobar la legibilidad",
];

export const Route = createFileRoute("/_app/presets/$presetId")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PresetEditorPage,
});

type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "error";

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function PresetEditorPage() {
  const { presetId } = Route.useParams();
  const navigate = useNavigate();
  const { presets, hasLoaded, savePreset, duplicatePreset, deletePreset } = usePresets();
  const { projects } = useProjects();
  const persisted = presets.find((preset) => preset.id === presetId) ?? null;
  const readOnly = isDefaultPresetId(presetId);

  const [draft, setDraft] = useState<Preset | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Preset | null>(null);
  draftRef.current = draft;

  // Sincroniza el borrador sin pisar ediciones pendientes.
  useEffect(() => {
    if (!persisted) return;
    setDraft((current) => {
      if (!current || current.id !== persisted.id) return persisted;
      if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error") return current;
      return persisted;
    });
  }, [persisted, saveStatus]);

  const clearTimer = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    const current = draftRef.current;
    if (!current || readOnly) return;
    clearTimer();
    setSaveStatus("saving");
    try {
      await savePreset(current);
      setSaveStatus("saved");
      setSavedAt(new Date());
    } catch {
      setSaveStatus("error");
    }
  }, [clearTimer, readOnly, savePreset]);

  const markDirty = useCallback(
    (next: Preset) => {
      if (readOnly) return;
      setDraft(next);
      setSaveStatus("dirty");
      clearTimer();
      saveTimer.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DELAY_MS);
    },
    [clearTimer, flush, readOnly],
  );

  const flushIfPending = useCallback(() => {
    if (saveStatus === "dirty") void flush();
  }, [flush, saveStatus]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const statusIndicator = useMemo(() => {
    if (readOnly) return <StatusBadge tone="neutral">Solo lectura</StatusBadge>;
    switch (saveStatus) {
      case "dirty":
        return <StatusBadge tone="sync" showDot={false}>Cambios sin guardar</StatusBadge>;
      case "saving":
        return <StatusBadge tone="sync" pulse>Guardando…</StatusBadge>;
      case "saved":
        return (
          <StatusBadge tone="online" showDot={false}>
            Guardado {savedAt ? formatTime(savedAt) : ""}
          </StatusBadge>
        );
      case "error":
        return <StatusBadge tone="live" showDot={false}>Error al guardar</StatusBadge>;
      default:
        return null;
    }
  }, [readOnly, saveStatus, savedAt]);

  if (!hasLoaded && !persisted) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground" role="status">
          Cargando preset…
        </p>
      </Page>
    );
  }

  const preset = draft;

  if (!preset) {
    return (
      <Page>
        <EmptyState
          icon={SlidersHorizontal}
          title="Preset no encontrado"
          description="El preset no existe o fue eliminado de este dispositivo."
          actions={
            <Button asChild variant="outline">
              <Link to="/presets">Volver a Presets</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const usage = findPresetUsage(projects, preset.id);

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/presets">
            <ArrowLeft />
            Presets
          </Link>
        </Button>
        <div aria-live="polite">{statusIndicator}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <div>
            <Label htmlFor="preset-title">Nombre</Label>
            <Input
              id="preset-title"
              value={preset.name}
              disabled={readOnly}
              maxLength={PRESET_NAME_MAX_LENGTH}
              className="mt-1.5 text-base font-semibold"
              onChange={(event) => markDirty({ ...preset, name: event.target.value })}
              onBlur={flushIfPending}
            />
            {readOnly ? (
              <p className="mt-2 text-xs text-muted-foreground">
                El preset por defecto no se edita ni se elimina. Duplícalo para partir de él.
              </p>
            ) : null}
          </div>

          <PresetStyleForm
            style={preset.style}
            disabled={readOnly}
            onChange={(style) => markDirty({ ...preset, style })}
            onCommit={flushIfPending}
          />

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void (async () => {
                  await flush();
                  const copy = await duplicatePreset(preset.id);
                  await navigate({ to: "/presets/$presetId", params: { presetId: copy.id } });
                })().catch(() => undefined);
              }}
            >
              <Copy />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={readOnly}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Eliminar
            </Button>
          </div>
        </div>

        <section aria-labelledby="preset-preview-title" className="min-w-0">
          <h2
            id="preset-preview-title"
            className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Vista previa
          </h2>
          <div className="aspect-video w-full overflow-hidden rounded-md border border-border">
            <SlideRenderer lines={SAMPLE_LINES} style={preset.style} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Texto de ejemplo. La salida real usa el mismo renderer, así que se ve igual en Live y en
            Output.
          </p>
        </section>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar preset</AlertDialogTitle>
            <AlertDialogDescription>
              {usage.occurrences > 0
                ? `“${preset.name}” está en uso por ${usage.occurrences} ${usage.occurrences === 1 ? "elemento" : "elementos"} (${usage.projectNames.join(", ")}). Esos elementos pasarán a usar el preset por defecto.`
                : `“${preset.name}” se eliminará de este dispositivo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void (async () => {
                  await deletePreset(preset.id);
                  await navigate({ to: "/presets" });
                })().catch(() => undefined);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
