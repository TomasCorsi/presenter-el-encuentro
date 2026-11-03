import { createFileRoute } from "@tanstack/react-router";
import { MediaProvider } from "@/features/media/media-context";
import { OutputFullscreenFrame } from "@/features/output/components/output-fullscreen-frame";
import { OutputSurface } from "@/features/output/components/output-surface";
import { OutputTestScreen } from "@/features/output/components/output-test-screen";
import { useOutputSnapshot } from "@/features/output/use-output-snapshot";

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
  // MediaProvider propio: Output es una ventana independiente y resuelve los
  // archivos desde el almacenamiento local de ESTE dispositivo.
  return (
    <MediaProvider>
      <OutputLiveScreen />
    </MediaProvider>
  );
}

function OutputLiveScreen() {
  const { snapshot } = useOutputSnapshot();
  return (
    <OutputFullscreenFrame>
      <OutputSurface snapshot={snapshot} />
    </OutputFullscreenFrame>
  );
}
