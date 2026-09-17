import { createFileRoute } from "@tanstack/react-router";
import { LayoutList, MoreVertical, Play, Plus } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TITLE = "Projects — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Gestión de proyectos y rundowns para servicios, eventos y transmisiones en vivo.";

export const Route = createFileRoute("/_app/projects")({
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
  component: ProjectsPage,
});

function ProjectsPage() {
  // Mock de datos para demostrar la composición compacta recomendada
  const mockProjects = [
    { id: "1", name: "Servicio Dominical Matutino", status: "live", items: 12, updated: "Hace 5m" },
    { id: "2", name: "Conferencia de Liderazgo", status: "online", items: 45, updated: "Ayer" },
    { id: "3", name: "Ensayo General", status: "offline", items: 8, updated: "Hace 2h" },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Producción"
        title="Projects"
        description="Proyectos y rundowns del workspace."
        actions={
          <Button size="sm" className="h-8 gap-2">
            <Plus className="size-4" />
            <span>Nuevo Proyecto</span>
          </Button>
        }
      />

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[400px]">Proyecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead className="w-[100px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockProjects.map((project) => (
              <TableRow key={project.id} className="group transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <LayoutList className="size-4 text-muted-foreground" />
                    {project.name}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={project.status as any}>
                    {project.status.toUpperCase()}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-mono text-xs">{project.items}</TableCell>
                <TableCell className="text-muted-foreground">{project.updated}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Play className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem>Editar detalles</DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 rounded-sm border border-border/50 bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider">Nota de Diseño Fase 2:</span>
          Composición compacta con tabla densa, acciones en hover y estados semánticos.
        </p>
      </div>
    </Page>
  );
}
