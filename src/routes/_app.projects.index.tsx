import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutList, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterProjects } from "@/domain/projects/project-rules";
import { ProjectDialog } from "@/features/projects/components/project-dialog";
import { ProjectList } from "@/features/projects/components/project-list";
import { useProjects } from "@/features/projects/projects-context";

const TITLE = "Projects — Plataforma de presentación en vivo";
const DESCRIPTION = "Gestión local de proyectos para servicios, eventos y transmisiones en vivo.";

export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, activeProjectId, hasLoaded, error, clearError, createProject, renameProject, duplicateProject, deleteProject, setActiveProject } = useProjects();
  const navigate = useNavigate({ from: "/projects/" });
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const visibleProjects = useMemo(() => filterProjects(projects, query), [projects, query]);

  async function handleCreate(name: string) {
    const project = await createProject(name);
    await navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
  }

  return (
    <Page>
      <PageHeader eyebrow="Producción" title="Projects" description="Producciones guardadas en este dispositivo."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus />Crear proyecto</Button>} />
      {error ? (
        <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span><Button variant="ghost" size="sm" onClick={clearError}>Cerrar</Button>
        </div>
      ) : null}
      {!hasLoaded ? <p className="text-sm text-muted-foreground" role="status">Cargando proyectos…</p> : projects.length === 0 ? (
        <EmptyState icon={LayoutList} title="Sin proyectos todavía" description="Crea un proyecto para comenzar a preparar una producción."
          actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus />Crear proyecto</Button>} />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyectos" aria-label="Buscar proyectos" className="pl-9" />
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">{visibleProjects.length} de {projects.length} proyectos</p>
          </div>
          <ProjectList projects={visibleProjects} activeProjectId={activeProjectId} hasQuery={Boolean(query.trim())}
            onActivate={setActiveProject} onRename={renameProject} onDuplicate={async (id) => { await duplicateProject(id); }} onDelete={deleteProject} />
        </>
      )}
      <ProjectDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} />
    </Page>
  );
}