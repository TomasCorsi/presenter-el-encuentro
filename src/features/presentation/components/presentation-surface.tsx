import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import type { VideoPlaybackState } from "@/domain/output/video-playback";
import type { ResolvedSlideBackground, SlideContent } from "@/domain/presentation/presentation";
import { DEFAULT_PRESET_STYLE, type PresetStyle } from "@/domain/presets/preset";
import { cn } from "@/lib/utils";

import { BackgroundLayer } from "./background-layer";
import { MediaSlideSurface } from "./media-slide-surface";
import { SlideRenderer } from "./slide-renderer";

export interface PresentationSurfaceProps {
  content: SlideContent;
  style: PresetStyle | undefined;
  background?: ResolvedSlideBackground | undefined;
  secondaryText?: string | undefined;
  transition?: BackgroundTransition | undefined;
  playback?: VideoPlaybackState | undefined;
  audio?: boolean;
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

export function PresentationSurface({
  content,
  style,
  background,
  secondaryText,
  transition = "cut",
  playback,
  audio = false,
  className,
  "data-testid": testId = "presentation-surface",
}: PresentationSurfaceProps) {
  const resolvedStyle = style ?? DEFAULT_PRESET_STYLE;
  const resolvedBackground = background ?? {
    type: "solid" as const,
    color: resolvedStyle.background.color,
  };

  return (
    <div data-testid={testId} className={cn("relative h-full w-full overflow-hidden", className)}>
      <BackgroundLayer background={resolvedBackground} transition={transition} />
      <div className="absolute inset-0">
        {content.kind === "text" ? (
          <SlideRenderer
            lines={content.lines}
            style={resolvedStyle}
            secondaryText={secondaryText}
            transparentBackground
          />
        ) : (
          <MediaSlideSurface
            mediaId={content.mediaId}
            kind={content.kind}
            playback={content.kind === "video" ? playback : undefined}
            audio={audio}
            className="bg-transparent"
          />
        )}
      </div>
    </div>
  );
}
