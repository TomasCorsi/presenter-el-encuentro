import { createFileRoute } from "@tanstack/react-router";

import { StreamOverlaySurface } from "@/features/output/components/stream-overlay-surface";
import { useStreamOutputState } from "@/features/output/use-stream-output-state";

const TRANSPARENT_DOCUMENT_CSS = `
html, body, [data-stream-output-root] {
  margin: 0;
  background: transparent !important;
  overflow: hidden;
}
`;

export const Route = createFileRoute("/output/stream")({
  head: () => ({
    meta: [
      { title: "Stream Overlay — Broadcast Control" },
      { name: "description", content: "Overlay transparente para OBS y vMix." },
      { name: "robots", content: "noindex" },
    ],
    styles: [{ children: TRANSPARENT_DOCUMENT_CSS }],
  }),
  component: StreamPage,
});

function StreamPage() {
  const { snapshot } = useStreamOutputState();
  return <StreamOverlaySurface snapshot={snapshot} />;
}
