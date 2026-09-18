import { Maximize } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Overlay efímero de Output: único control disponible, pensado para el
 * operador que configura la ventana (fullscreen manual). Se oculta con el
 * cursor tras la inactividad y desaparece por completo en pantalla completa;
 * nunca aparece sobre el proyector en reposo.
 */
export interface OutputOverlayProps {
  visible: boolean;
  onEnterFullscreen: () => void;
  /** Ayuda breve para el modo alternativo (ventana movida a mano). */
  hint?: string;
}

export function OutputOverlay({ visible, onEnterFullscreen, hint }: OutputOverlayProps) {
  return (
    <div
      data-testid="output-overlay"
      className={cn(
        "fixed right-4 bottom-4 flex items-center gap-3 transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {hint ? (
        <span className="bg-muted/60 text-muted-foreground rounded-md px-3 py-1.5 text-xs backdrop-blur">
          {hint}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onEnterFullscreen}
        aria-label="Iniciar salida en pantalla completa"
        className="bg-muted/60 text-muted-foreground hover:bg-muted flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold backdrop-blur"
      >
        <Maximize className="h-4 w-4" />
        Iniciar salida
      </button>
    </div>
  );
}
