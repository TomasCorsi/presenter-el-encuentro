import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProgramMode } from "@/domain/presentation/presentation";

import { LiveControls, type LiveControlsProps } from "./live-controls";

export interface LiveOperationBarProps extends LiveControlsProps {
  programMode: ProgramMode;
  /** Abre y enfoca la biblioteca operativa; no es un buscador aparte. */
  onSearch(): void;
  libraryOpen: boolean;
}

/**
 * Barra de operación FIJA bajo la barra de show: Previous, Next, TAKE, Clear,
 * Black y el acceso a la biblioteca. Nunca queda fuera de vista, porque es la
 * grilla de trabajo la que se comprime.
 */
export function LiveOperationBar({ onSearch, libraryOpen, ...controls }: LiveOperationBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
      <LiveControls {...controls} />
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={onSearch}
        aria-expanded={libraryOpen}
        aria-controls="live-library-dock"
        title="Buscar en la biblioteca (/)"
      >
        <Search />
        Buscar
        <span className="ml-1 font-mono text-[10px] text-muted-foreground" aria-hidden="true">/</span>
      </Button>
    </div>
  );
}
