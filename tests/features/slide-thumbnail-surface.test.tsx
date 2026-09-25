import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Slide } from "@/domain/presentation/presentation";
import type { PresetStyle } from "@/domain/presets/preset";
import { SlideThumbnailSurface } from "@/features/presentation/components/slide-thumbnail-surface";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");

const style: PresetStyle = {
  fontFamily: "serif",
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.4,
  align: "right",
  verticalAlign: "bottom",
  textColor: "#FEDCBA",
  background: { type: "solid", color: "#123456" },
  safeAreaX: 7,
  safeAreaY: 6,
};

function textSlide(patch: Partial<Slide> = {}): Slide {
  return {
    id: "item:slide",
    itemId: "item",
    order: 0,
    content: { kind: "text", lines: ["Gracia sublime"] },
    style,
    background: { type: "solid", color: "#123456" },
    ...patch,
  };
}

describe("SlideThumbnailSurface", () => {
  it("renders a Song solid with the shared resolved typography and safe area", () => {
    const html = renderToStaticMarkup(<SlideThumbnailSurface slide={textSlide()} />);

    expect(html).toContain("Gracia sublime");
    expect(html).toContain("background-color:#123456");
    expect(html).toContain("font-family:ui-serif");
    expect(html).toContain("font-size:9cqh");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("line-height:1.4");
    expect(html).toContain("text-align:right");
    expect(html).toContain("justify-content:flex-end");
    expect(html).toContain("align-items:flex-end");
    expect(html).toContain("padding-inline:7cqw");
    expect(html).toContain("padding-block:6cqh");
    expect(html).toContain("color:#FEDCBA");
  });

  it("renders an image background from metadata without a runtime URL", () => {
    const html = renderToStaticMarkup(
      <SlideThumbnailSurface
        slide={textSlide({
          background: {
            type: "media",
            mediaId: "image-1",
            kind: "image",
            fallbackColor: "#112233",
          },
        })}
        backgroundThumbnailDataUrl="data:image/jpeg;base64,IMAGE"
      />,
    );

    expect(html).toContain('src="data:image/jpeg;base64,IMAGE"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain("object-cover");
  });

  it("renders a video background as a static image and never creates video", () => {
    const html = renderToStaticMarkup(
      <SlideThumbnailSurface
        slide={textSlide({
          background: {
            type: "media",
            mediaId: "video-1",
            kind: "video",
            fallbackColor: "#223344",
          },
        })}
        backgroundThumbnailDataUrl="data:image/jpeg;base64,VIDEO"
      />,
    );

    expect(html).toContain('src="data:image/jpeg;base64,VIDEO"');
    expect(html).toContain("<img");
    expect(html).not.toContain("<video");
  });

  it("renders Bible secondary text through the shared renderer", () => {
    const html = renderToStaticMarkup(
      <SlideThumbnailSurface
        slide={textSlide({
          content: { kind: "text", lines: ["Porque de tal manera amó Dios al mundo"] },
          secondaryText: "Juan 3:16 · NVI",
        })}
      />,
    );

    expect(html).toContain("Porque de tal manera amó Dios al mundo");
    expect(html).toContain("Juan 3:16 · NVI");
    expect(html).toContain('data-testid="slide-secondary-text"');
  });

  it("keeps the real Preset fallback when thumbnail metadata is absent", () => {
    const html = renderToStaticMarkup(
      <SlideThumbnailSurface
        slide={textSlide({
          background: {
            type: "media",
            mediaId: "missing",
            kind: "image",
            fallbackColor: "#654321",
          },
        })}
      />,
    );

    expect(html).toContain("background-color:#654321");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<video");
  });

  it("removes a broken thumbnail and leaves the real solid fallback visible", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(SlideThumbnailSurface, {
          slide: textSlide({
            background: {
              type: "media",
              mediaId: "broken",
              kind: "image",
              fallbackColor: "#ABCDEF",
            },
          }),
          backgroundThumbnailDataUrl: "data:image/jpeg;base64,BROKEN",
        }),
      );
    });

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    await act(async () => image?.dispatchEvent(new Event("error")));
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).toContain("#ABCDEF");

    await act(async () => root.unmount());
  });
});
