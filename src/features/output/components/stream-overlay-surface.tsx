import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import type { PresetStyle } from "@/domain/presets/preset";
import { SlideRenderer } from "@/features/presentation/components/slide-renderer";

export const STREAM_SAFE_AREA_X = 6;
export const STREAM_SAFE_AREA_Y = 7;
export const STREAM_FONT_SIZE = 5.5;

function streamStyle(style: PresetStyle): PresetStyle {
  return {
    ...style,
    fontSize: STREAM_FONT_SIZE,
    lineHeight: 1.18,
    align: "left",
    verticalAlign: "bottom",
    safeAreaX: STREAM_SAFE_AREA_X,
    safeAreaY: STREAM_SAFE_AREA_Y,
  };
}

export function StreamOverlaySurface({ snapshot }: { snapshot: OutputSnapshot | null }) {
  const slide = snapshot?.mode === "content" ? snapshot.slide : null;
  const textContent = slide?.content.kind === "text" ? slide.content : null;

  return (
    <main
      data-stream-output-root
      data-testid="stream-overlay-surface"
      className="h-dvh w-full overflow-hidden"
      style={{
        background: "transparent",
        containerType: "size",
        textShadow: "0 0.035em 0.08em rgba(0,0,0,0.95), 0 0.08em 0.2em rgba(0,0,0,0.8)",
      }}
    >
      {slide && textContent ? (
        <SlideRenderer
          lines={textContent.lines}
          style={streamStyle(slide.style)}
          secondaryText={slide.secondaryText}
          transparentBackground
          className="bg-transparent"
        />
      ) : null}
    </main>
  );
}
