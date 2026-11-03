import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import { DEFAULT_PRESET_STYLE } from "@/domain/presets/preset";
import {
  STREAM_FONT_SIZE,
  STREAM_SAFE_AREA_X,
  STREAM_SAFE_AREA_Y,
  StreamOverlaySurface,
} from "@/features/output/components/stream-overlay-surface";

function snapshot(
  mode: OutputSnapshot["mode"],
  content: OutputSnapshot["slide"] extends infer _ ? "text" | "image" | "video" : never = "text",
): OutputSnapshot {
  return {
    sessionId: "live-a",
    sequence: 1,
    mode,
    backgroundTransition: "fade",
    slide: {
      id: "slide-1",
      content:
        content === "text"
          ? { kind: "text", lines: ["Porque de tal manera", "amó Dios"] }
          : { kind: content, mediaId: "media-1" },
      secondaryText: "Juan 3:16 · NVI",
      style: DEFAULT_PRESET_STYLE,
      background: { type: "media", mediaId: "bg-1", kind: "video", fallbackColor: "#000000" },
    },
  };
}

describe("StreamOverlaySurface", () => {
  it("renderiza texto y referencia como lower third transparente", () => {
    const html = renderToStaticMarkup(<StreamOverlaySurface snapshot={snapshot("content")} />);
    expect(html).toContain("Porque de tal manera");
    expect(html).toContain("Juan 3:16 · NVI");
    expect(html).toContain("background:transparent");
    expect(html).toContain(`font-size:${STREAM_FONT_SIZE}cqh`);
    expect(html).toContain(`padding-inline:${STREAM_SAFE_AREA_X}cqw`);
    expect(html).toContain(`padding-block:${STREAM_SAFE_AREA_Y}cqh`);
    expect(html).toContain("justify-content:flex-end");
    expect(html).toContain("text-align:left");
    expect(html).not.toContain("background-layer");
    expect(html).not.toContain("bg-1");
  });

  it("deja Media, Clear, Black, stale y ausencia de Program totalmente vacios", () => {
    const values: Array<OutputSnapshot | null> = [
      snapshot("content", "image"),
      snapshot("content", "video"),
      snapshot("clear"),
      snapshot("black"),
      { ...snapshot("content"), slide: null },
      null,
    ];

    for (const value of values) {
      const html = renderToStaticMarkup(<StreamOverlaySurface snapshot={value} />);
      expect(html).not.toContain("slide-renderer");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<video");
      expect(html).toContain("background:transparent");
    }
  });
});
