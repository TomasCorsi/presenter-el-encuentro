import { Link } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";

import type { Project } from "@/domain/projects/project";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ProjectActions } from "./project-actions";

export interface ProjectRowProps {
  project: Project;
  isActive: boolean;
  onActivate(): Promise<void>;
  onRename(name: string): Promise<void>;
  onDuplicate(): Promise<void>;
  onDelete(): Promise<void>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ProjectRow({ project, isActive, ...actions }: ProjectRowProps) {
  return (
    <TableRow data-state={isActive ? "selected" : undefined}>
      <TableCell className="min-w-0 py-3">
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="group inline-flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-muted text-muted-foreground group-hover:text-primary">
            <FolderOpen className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate font-medium text-foreground group-hover:text-primary">{project.name}</span>
        </Link>
      </TableCell>
      <TableCell className="w-28">{isActive ? <StatusBadge tone="online">Activo</StatusBadge> : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="w-56 whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDate(project.updatedAt)}</TableCell>
      <TableCell className="w-14 text-right"><ProjectActions project={project} isActive={isActive} {...actions} /></TableCell>
    </TableRow>
  );
}