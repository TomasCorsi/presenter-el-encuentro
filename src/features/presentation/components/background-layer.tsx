import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import type { ResolvedSlideBackground } from "@/domain/presentation/presentation";
import { useMediaUrl } from "@/features/media/media-context";

import { BackgroundVisual } from "./background-visual";

const FADE_MS = 500;

function backgroundIdentity(background: ResolvedSlideBackground): string {
  return background.type === "solid"
    ? `solid:${background.color}`
    : `media:${background.kind}:${background.mediaId}:${background.fallbackColor}`;
}

function RuntimeBackgroundVisual({ background }: { background: ResolvedSlideBackground }) {
  const mediaId = background.type === "media" ? background.mediaId : null;
  const url = useMediaUrl(mediaId);
  return <BackgroundVisual background={background} mediaUrl={url} />;
}

export interface BackgroundLayerProps {
  background: ResolvedSlideBackground;
  transition?: BackgroundTransition;
}

/** Crossfade local: el primer montaje nunca anima una transicion historica. */
export function BackgroundLayer({ background, transition = "cut" }: BackgroundLayerProps) {
  const [current, setCurrent] = useState(background);
  const [previous, setPrevious] = useState<ResolvedSlideBackground | null>(null);
  const [entered, setEntered] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (backgroundIdentity(current) === backgroundIdentity(background)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    if (transition === "cut") {
      setPrevious(null);
      setCurrent(background);
      setEntered(true);
      return;
    }

    setPrevious(current);
    setCurrent(background);
    setEntered(false);
    frameRef.current = requestAnimationFrame(() => {
      setEntered(true);
      frameRef.current = null;
    });
    timerRef.current = setTimeout(() => {
      setPrevious(null);
      timerRef.current = null;
    }, FADE_MS);
  }, [background, current, transition]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    <div data-testid="background-layer" className="absolute inset-0">
      {previous ? <RuntimeBackgroundVisual background={previous} /> : null}
      <div
        className="absolute inset-0"
        style={{
          opacity: entered ? 1 : 0,
          transition: previous ? `opacity ${FADE_MS}ms ease` : undefined,
        }}
      >
        <RuntimeBackgroundVisual background={current} />
      </div>
    </div>
  );
}
