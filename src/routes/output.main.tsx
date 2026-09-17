import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { OutputOverlay } from "@/features/output/components/output-overlay";
import { OutputSurface } from "@/features/output/components/output-surface";
import { useIdleUi } from "@/features/output/use-idle-ui";
import { useOutputSnapshot } from "@/features/output/use-output-snapshot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/output/main")({
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
 */
function OutputMainPage() {
  const { snapshot } = useOutputSnapshot();
  const { idle } = useIdleUi();

  const enterFullscreen = useCallback(() => {
    void document.documentElement.requestFullscreen?.();
  }, []);

  return (
    <div
      className={cn("h-dvh w-full overflow-hidden", idle && "cursor-none")}
      onDoubleClick={enterFullscreen}
    >
      <OutputSurface snapshot={snapshot} />
      <OutputOverlay visible={!idle} onEnterFullscreen={enterFullscreen} />
    </div>
  );
}
