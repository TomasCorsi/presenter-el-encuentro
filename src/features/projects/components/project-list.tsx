import { SearchX } from "lucide-react";

import type { Project } from "@/domain/projects/project";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectRow } from "./project-row";

export interface ProjectListProps {
  projects: Project[];
  activeProjectId: string | null;
  hasQuery: boolean;
  onActivate(id: string): Promise<void>;
  onRename(id: string, name: string): Promise<void>;
  onDuplicate(id: string): Promise<void>;
  onDelete(id: string): Promise<void>;
}

export function ProjectList({ projects, activeProjectId, hasQuery, ...actions }: ProjectListProps) {
  if (projects.length === 0 && hasQuery) {
    return <EmptyState icon={SearchX} title="Sin resultados" description="Prueba con otro nombre de proyecto." />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Proyecto</TableHead><TableHead>Estado</TableHead>
            <TableHead>Última modificación</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              onActivate={() => actions.onActivate(project.id)}
              onRename={(name) => actions.onRename(project.id, name)}
              onDuplicate={() => actions.onDuplicate(project.id)}
              onDelete={() => actions.onDelete(project.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}