import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { OutputOverlay } from "@/features/output/components/output-overlay";
import { OutputSurface } from "@/features/output/components/output-surface";
import { OutputTestScreen } from "@/features/output/components/output-test-screen";
import { useFullscreen } from "@/features/output/use-fullscreen";
import { useIdleUi } from "@/features/output/use-idle-ui";
import { useOutputSnapshot } from "@/features/output/use-output-snapshot";
import { cn } from "@/lib/utils";

interface OutputSearch {
  mode: "test" | undefined;
  n: string | undefined;
}

export const Route = createFileRoute("/output/main")({
  validateSearch: (search: Record<string, unknown>): OutputSearch => ({
    mode: search["mode"] === "test" ? "test" : undefined,
    n: typeof search["n"] === "string" ? search["n"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Output — Broadcast Control" },
      { name: "description", content: "Salida de presentación en vivo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OutputMainPage,
});

/**
 * `/output/main`: superficie de salida fuera del App Shell. Viewport
 * completo, sin scroll, sin chrome. Solo consume el protocolo Output Sync;
 * nunca envía comandos a Live.
 *
 * `?mode=test` muestra la pantalla de prueba aislada: no se suscribe al canal
 * ni adopta ninguna sesión Live.
 */
function OutputMainPage() {
  const { mode, n } = Route.useSearch();
  if (mode === "test") return <OutputTestScreen screenNumber={n ?? null} />;
  return <OutputLiveScreen />;
}

function OutputLiveScreen() {
  const { snapshot } = useOutputSnapshot();
  const { idle } = useIdleUi();
  const { fullscreen, enter } = useFullscreen();

  const enterFullscreen = useCallback(() => {
    void enter();
  }, [enter]);

  // Tecla F: tercera vía hacia pantalla completa, junto al botón y el doble
  // clic. Nunca automática al cargar: el navegador la bloquearía.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      void enter();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enter]);

  return (
    <div
      className={cn("h-dvh w-full overflow-hidden", (idle || fullscreen) && "cursor-none")}
      onDoubleClick={enterFullscreen}
    >
      <OutputSurface snapshot={snapshot} />
      <OutputOverlay
        visible={!idle && !fullscreen}
        onEnterFullscreen={enterFullscreen}
        hint="F o doble clic"
      />
    </div>
  );
}
