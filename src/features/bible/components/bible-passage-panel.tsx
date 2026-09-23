import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { passageCaption, type BiblePassage } from "@/domain/bible/bible";
import { passageToPresentationItem } from "@/domain/presentation/passage-to-presentation";
import type { Project } from "@/domain/projects/project";
import { SlideRenderer } from "@/features/presentation/components/slide-renderer";

export interface BiblePassagePanelProps {
  passage: BiblePassage | null;
  projects: readonly Project[];
  defaultProjectId: string | null;
  onAdd(projectId: string, passage: BiblePassage): Promise<void>;
}

/**
 * Vista previa del pasaje con el MISMO renderer que Live y Output, y alta en el
 * rundown. El pasaje se guarda con su texto: el proyecto no dependerá de que la
 * traducción siga instalada (ADR-042).
 */
export function BiblePassagePanel({ passage, projects, defaultProjectId, onAdd }: BiblePassagePanelProps) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedProjectId = projectId || defaultProjectId || projects[0]?.id || "";
  const slides = passage ? passageToPresentationItem(passage, { itemId: "preview" }).slides : [];

  async function handleAdd() {
    if (!passage || !selectedProjectId) return;
    setBusy(true);
    setStatus(null);
    try {
      await onAdd(selectedProjectId, passage);
      setStatus(`${passageCaption(passage)} se agregó al rundown.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo agregar el pasaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-labelledby="passage-panel-title" className="flex min-h-0 flex-col rounded-md border border-border bg-card">
      <div className="border-b border-border p-3">
        <h2 id="passage-panel-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pasaje
        </h2>
        <p className="mt-1 truncate text-sm text-foreground">
          {passage ? passageCaption(passage) : "Selecciona uno o varios versículos."}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {slides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aquí verás cómo se proyectará cada versículo.</p>
        ) : (
          slides.map((slide) => (
            <div key={slide.id} className="aspect-video overflow-hidden rounded-sm border border-border">
              <SlideRenderer
                lines={slideTextLines(slide.content) as string[]}
                style={slide.style}
                secondaryText={slide.secondaryText}
              />
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <Select value={selectedProjectId} onValueChange={setProjectId} disabled={projects.length === 0}>
          <SelectTrigger aria-label="Proyecto de destino">
            <SelectValue placeholder="Selecciona un proyecto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="w-full"
          disabled={!passage || !selectedProjectId || busy}
          onClick={() => void handleAdd()}
        >
          <Plus aria-hidden="true" />
          {busy ? "Agregando…" : "Agregar al proyecto"}
        </Button>

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">Crea un proyecto para poder agregar pasajes.</p>
        ) : null}
        {status ? <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p> : null}
      </div>
    </aside>
  );
}
