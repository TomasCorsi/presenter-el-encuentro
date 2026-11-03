import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import { DEFAULT_PRESET_STYLE } from "@/domain/presets/preset";
import { OutputSurface } from "@/features/output/components/output-surface";
import { MediaProvider } from "@/features/media/media-context";
import { createInMemoryMediaRepository } from "@/services/media/in-memory-media-repository";
import { createInMemoryMediaStorage } from "@/services/media/in-memory-media-storage";

function snapshot(mode: OutputSnapshot["mode"], withStage = false): OutputSnapshot {
  return {
    sessionId: "live-a",
    sequence: 8,
    mode,
    backgroundTransition: "cut",
    slide: {
      id: "song:1",
      content: { kind: "text", lines: ["Program real"] },
      style: DEFAULT_PRESET_STYLE,
      background: { type: "solid", color: DEFAULT_PRESET_STYLE.background.color },
    },
    stage: withStage
      ? {
          current: {
            slideId: "song:1",
            itemId: "song",
            itemTitle: "Song",
            itemType: "song",
            content: { kind: "text", lines: ["Program real"] },
          },
          next: null,
        }
      : undefined,
  };
}

function renderOutput(value: OutputSnapshot): string {
  return renderToStaticMarkup(
    <MediaProvider
      repository={createInMemoryMediaRepository()}
      fileStorage={createInMemoryMediaStorage()}
      initialAssets={[]}
    >
      <OutputSurface snapshot={value} />
    </MediaProvider>,
  );
}

describe("Output Main regression", () => {
  it("renderiza Content e ignora completamente la proyección Stage", () => {
    const withoutStage = renderOutput(snapshot("content"));
    const withStage = renderOutput(snapshot("content", true));
    expect(withStage).toBe(withoutStage);
    expect(withStage).toContain("Program real");
    expect(withStage).toContain('data-testid="output-presentation-surface"');
  });

  it("mantiene Clear vacío y Black negro aunque Stage conserve current", () => {
    const clear = renderToStaticMarkup(<OutputSurface snapshot={snapshot("clear", true)} />);
    const black = renderToStaticMarkup(<OutputSurface snapshot={snapshot("black", true)} />);
    expect(clear).not.toContain("Program real");
    expect(clear).toContain("bg-output-base");
    expect(black).not.toContain("Program real");
    expect(black).toContain("bg-output-safe");
  });
});
