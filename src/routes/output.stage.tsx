import { createFileRoute } from "@tanstack/react-router";

import { OutputFullscreenFrame } from "@/features/output/components/output-fullscreen-frame";
import { StageDisplay } from "@/features/output/components/stage-display";
import { MediaProvider, useMedia } from "@/features/media/media-context";
import { useStageClock } from "@/features/output/use-stage-clock";
import { useStageOutputState } from "@/features/output/use-stage-output-state";

export const Route = createFileRoute("/output/stage")({
  head: () => ({
    meta: [
      { title: "Stage Display — Broadcast Control" },
      { name: "description", content: "Salida de referencia para el equipo de plataforma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  return (
    <MediaProvider>
      <StageLiveScreen />
    </MediaProvider>
  );
}

function StageLiveScreen() {
  const { assets } = useMedia();
  const { connection, snapshot } = useStageOutputState();
  const clock = useStageClock();

  return (
    <OutputFullscreenFrame>
      <StageDisplay
        snapshot={snapshot}
        connection={connection}
        clock={clock}
        assets={assets}
      />
    </OutputFullscreenFrame>
  );
}
