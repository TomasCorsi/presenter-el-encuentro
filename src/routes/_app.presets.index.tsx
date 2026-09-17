import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { findPresetUsage } from "@/domain/presets/preset-resolution";
import { filterPresets } from "@/domain/presets/preset-rules";
import { PresetDialog } from "@/features/presets/components/preset-dialog";
import { PresetRow } from "@/features/presets/components/preset-row";
import { usePresets } from "@/features/presets/presets-context";
import { useProjects } from "@/features/projects/projects-context";

const TITLE = "Presets — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Biblioteca de estilos reutilizables: tipografía, tamaño, alineación, color y safe area.";

export const Route = createFileRoute("/_app/presets/")({
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
  component: PresetsPage,
});

function PresetsPage() {
  const navigate = useNavigate();
  const { presets, hasLoaded, error, clearError, createPreset, renamePreset, duplicatePreset, deletePreset } =
    usePresets();
  const { projects } = useProjects();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  const visible = useMemo(() => filterPresets(presets, query), [presets, query]);
  const renaming = presets.find((preset) => preset.id === renameTarget) ?? null;

  return (
    <Page>
      <PageHeader
        eyebrow="Apariencia"
        title="Presets"
        description="Estilos de presentación reutilizables, separados del contenido."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nuevo preset
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Cerrar
          </Button>
        </div>
      ) : null}

      <div className="mb-4 relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar preset"
          aria-label="Buscar preset"
          className="pl-9"
        />
      </div>

      {!hasLoaded ? (
        <p className="text-sm text-muted-foreground" role="status">
          Cargando presets…
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Sin resultados"
          description="Ningún preset coincide con la búsqueda."
        />
      ) : (
        <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
          {visible.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              usage={findPresetUsage(projects, preset.id)}
              onRename={() => setRenameTarget(preset.id)}
              onDuplicate={async () => {
                const copy = await duplicatePreset(preset.id);
                await navigate({ to: "/presets/$presetId", params: { presetId: copy.id } });
              }}
              onDelete={() => deletePreset(preset.id)}
            />
          ))}
        </ul>
      )}

      <PresetDialog
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        onSubmit={async (name) => {
          const preset = await createPreset(name);
          await navigate({ to: "/presets/$presetId", params: { presetId: preset.id } });
        }}
      />

      <PresetDialog
        open={renaming !== null}
        mode="rename"
        initialName={renaming?.name}
        onOpenChange={(open) => setRenameTarget(open ? renameTarget : null)}
        onSubmit={(name) => renamePreset(renaming!.id, name)}
      />
    </Page>
  );
}
