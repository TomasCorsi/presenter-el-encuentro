import { Maximize } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Overlay efímero de Output: único control disponible, pensado para el
 * operador que configura la ventana (fullscreen manual). Se oculta con el
 * cursor tras la inactividad; nunca aparece sobre el proyector en reposo.
 */
export interface OutputOverlayProps {
  visible: boolean;
  onEnterFullscreen: () => void;
}

export function OutputOverlay({ visible, onEnterFullscreen }: OutputOverlayProps) {
  return (
    <div
      data-testid="output-overlay"
      className={cn(
        "fixed right-4 bottom-4 transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        onClick={onEnterFullscreen}
        aria-label="Pantalla completa"
        className="bg-muted/60 text-muted-foreground hover:bg-muted flex h-10 w-10 items-center justify-center rounded-full backdrop-blur"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
}
