import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, ListEnd, Radio } from "lucide-react";
import { useMemo } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { RundownList } from "@/features/projects/components/rundown-list";
import { SongPickerPanel } from "@/features/projects/components/song-picker-panel";
import { usePresets } from "@/features/presets/presets-context";
import { useProjects } from "@/features/projects/projects-context";
import { useSongs } from "@/features/songs/songs-context";

const TITLE = "Detalle del proyecto — Plataforma de presentación en vivo";
const DESCRIPTION = "Preparación del rundown: secuencia ordenada de contenido para el evento.";

export const Route = createFileRoute("/_app/projects/$projectId")({
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
  component: ProjectDetailPage,
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const {
    projects, activeProjectId, hasLoaded, error, clearError,
    setActiveProject, addSongToProject, removeRundownItem, moveRundownItem, setRundownItemPreset,
  } = useProjects();
  const { presets } = usePresets();
  const { songs, hasLoaded: songsLoaded } = useSongs();
  const project = projects.find((item) => item.id === projectId);

  const usageBySongId = useMemo(() => {
    const usage = new Map<string, number>();
    for (const item of project?.rundown ?? []) {
      if (item.type !== "song") continue;
      usage.set(item.sourceId, (usage.get(item.sourceId) ?? 0) + 1);
    }
    return usage;
  }, [project?.rundown]);

  if (!hasLoaded) {
    return <Page><p className="text-sm text-muted-foreground" role="status">Cargando proyecto…</p></Page>;
  }

  if (!project) {
    return (
      <Page>
        <EmptyState
          icon={ListEnd}
          title="Proyecto no encontrado"
          description="El proyecto no existe o fue eliminado de este dispositivo."
          actions={<Button asChild variant="outline"><Link to="/projects">Volver a Projects</Link></Button>}
        />
      </Page>
    );
  }

  const isActive = project.id === activeProjectId;

  return (
    <Page>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/projects"><ArrowLeft />Projects</Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Preparación"
        title={project.name}
        description="Arma la secuencia del evento antes de entrar a Live."
        actions={isActive ? <StatusBadge tone="online">Activo</StatusBadge> : (
          <Button size="sm" onClick={() => void setActiveProject(project.id).catch(() => undefined)}><Radio />Marcar como activo</Button>
        )}
      />

      {error ? (
        <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span><Button variant="ghost" size="sm" onClick={clearError}>Cerrar</Button>
        </div>
      ) : null}

      <section aria-labelledby="project-details-title" className="mb-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        <h2 id="project-details-title" className="sr-only">Datos del proyecto</h2>
        <div className="flex items-start gap-3 bg-card p-4">
          <Calendar className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div><p className="text-xs uppercase text-muted-foreground">Creado</p><p className="mt-1 text-sm text-foreground">{formatDate(project.createdAt)}</p></div>
        </div>
        <div className="flex items-start gap-3 bg-card p-4">
          <Clock className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div><p className="text-xs uppercase text-muted-foreground">Última modificación</p><p className="mt-1 text-sm text-foreground">{formatDate(project.updatedAt)}</p></div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <SongPickerPanel
          songs={songs}
          loading={!songsLoaded}
          usageBySongId={usageBySongId}
          onAdd={async (song) => {
            await addSongToProject(project.id, { id: song.id, title: song.title });
          }}
        />

        <section aria-labelledby="rundown-title" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="rundown-title" className="text-base font-semibold text-foreground">Rundown</h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {project.rundown.length} {project.rundown.length === 1 ? "elemento" : "elementos"}
            </p>
          </div>
          <RundownList
            items={project.rundown}
            songs={songs}
            presets={presets}
            onMove={(itemId, direction) => moveRundownItem(project.id, itemId, direction)}
            onRemove={(itemId) => removeRundownItem(project.id, itemId)}
            onSetPreset={(itemId, presetId) => setRundownItemPreset(project.id, itemId, presetId)}
          />
        </section>
      </div>
    </Page>
  );
}
