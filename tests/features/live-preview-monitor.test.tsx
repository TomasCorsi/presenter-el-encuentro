import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "bun:test";

import type { PresentationItem, Slide } from "@/domain/presentation/presentation";
import { LivePreviewMonitor } from "@/features/live/components/live-preview-monitor";
import { MediaProvider } from "@/features/media/media-context";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";

const slide: Slide = {
  id: "bible:1",
  itemId: "bible",
  order: 0,
  content: { kind: "text", lines: ["Porque de tal manera amó Dios al mundo"] },
  secondaryText: "Juan 3:16 · NVI",
  background: { type: "solid", color: "#101820" },
};

const item: PresentationItem = {
  id: "bible",
  type: "bible",
  title: "Juan 3:16",
  order: 0,
  slides: [slide],
};

describe("LivePreviewMonitor", () => {
  it("renders the prepared slide with its shared visual surface and metadata", () => {
    const html = renderToStaticMarkup(
      <MediaProvider
        repository={createInMemoryMediaRepository()}
        fileStorage={createInMemoryMediaStorage()}
        initialAssets={[]}
      >
        <LivePreviewMonitor previewSlide={slide} previewItem={item} presetName="Lectura" />
      </MediaProvider>,
    );

    expect(html).toContain("Preview");
    expect(html).toContain("Preparado");
    expect(html).toContain("Porque de tal manera amó Dios al mundo");
    expect(html).toContain("Juan 3:16 · NVI");
    expect(html).toContain("Lectura");
    expect(html).toContain('data-testid="presentation-surface"');
    expect(html).toContain('data-testid="preview-monitor-viewport"');
    expect(html).toContain('data-testid="slide-surface"');
    expect(html).toContain("width:min(100cqw, 177.7778cqh)");
    expect(html).toContain("height:min(100cqh, 56.25cqw)");
  });

  it("renders a neutral empty state without inventing Program content", () => {
    const html = renderToStaticMarkup(
      <LivePreviewMonitor previewSlide={null} previewItem={null} />,
    );

    expect(html).toContain("Nada preparado");
    expect(html).not.toContain("Program");
  });
});
