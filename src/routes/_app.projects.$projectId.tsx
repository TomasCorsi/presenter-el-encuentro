import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, ListEnd, Radio } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useProjects } from "@/features/projects/projects-context";

const TITLE = "Detalle del proyecto — Plataforma de presentación en vivo";
const DESCRIPTION = "Contexto y datos principales de un proyecto de producción.";

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
  const { projects, activeProjectId, loading, setActiveProject } = useProjects();
  const project = projects.find((item) => item.id === projectId);

  if (loading) {
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
        eyebrow="Proyecto"
        title={project.name}
        description="Contexto de la producción actual."
        actions={isActive ? <StatusBadge tone="online">Activo</StatusBadge> : (
          <Button size="sm" onClick={() => void setActiveProject(project.id).catch(() => undefined)}><Radio />Marcar como activo</Button>
        )}
      />

      <section aria-labelledby="project-details-title" className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
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

      <section aria-labelledby="rundown-title" className="mt-6 border-t border-border pt-5">
        <h2 id="rundown-title" className="text-base font-semibold text-foreground">Rundown</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">El rundown se implementará en una fase posterior.</p>
      </section>
    </Page>
  );
}