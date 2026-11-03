import { describe, expect, it } from "bun:test";

describe("Stream route contract", () => {
  it("es transparente, read-only y no monta Media ni fullscreen chrome", async () => {
    const source = await Bun.file("src/routes/output.stream.tsx").text();
    const surface = await Bun.file(
      "src/features/output/components/stream-overlay-surface.tsx",
    ).text();

    expect(source).toContain("useStreamOutputState");
    expect(source).toContain("background: transparent !important");
    expect(source).not.toContain("usePresentationStore");
    expect(source).not.toContain("OutputFullscreenFrame");
    expect(surface).toContain("SlideRenderer");
    expect(surface).not.toContain("MediaProvider");
    expect(surface).not.toContain("MediaSlideSurface");
    expect(surface).not.toContain("BackgroundLayer");
    expect(surface).not.toContain("<video");
    expect(surface).not.toContain("<img");
  });
});
