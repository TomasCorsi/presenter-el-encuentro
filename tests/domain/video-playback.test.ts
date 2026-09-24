import { describe, expect, it } from "bun:test";

import {
  createInitialPlayback,
  expectedOffsetSeconds,
  pausePlayback,
  playPlayback,
  restartPlayback,
  shouldCorrectVideoDrift,
  togglePlaybackLoop,
} from "@/domain/output/video-playback";
import type { PresentationItem } from "@/domain/presentation/presentation";
import {
  createInitialPresentationState,
  loadPresentation,
} from "@/domain/presentation/presentation-engine";
import { goLive } from "@/domain/presentation/presentation-live";
import { setProgramMode } from "@/domain/presentation/presentation-program";
import { getProgramSlide } from "@/domain/presentation/presentation-selectors";

const EPOCH = 1_700_000_000_000;

describe("VideoPlaybackState", () => {
  it("empieza reproduciendo desde cero con timestamp epoch y revisión 1", () => {
    expect(createInitialPlayback(EPOCH)).toEqual({
      state: "playing",
      offsetSeconds: 0,
      changedAtEpochMs: EPOCH,
      loop: false,
      revision: 1,
    });
  });

  it("pausa en la posición esperada y no avanza mientras está pausado", () => {
    const paused = pausePlayback(createInitialPlayback(EPOCH), EPOCH + 2_500);
    expect(paused.state).toBe("paused");
    expect(paused.offsetSeconds).toBe(2.5);
    expect(paused.revision).toBe(2);
    expect(expectedOffsetSeconds(paused, EPOCH + 12_500)).toBe(2.5);
    expect(pausePlayback(paused, EPOCH + 20_000)).toBe(paused);
  });

  it("reanuda desde el offset pausado sin reiniciar", () => {
    const paused = pausePlayback(createInitialPlayback(EPOCH), EPOCH + 2_000);
    const playing = playPlayback(paused, EPOCH + 5_000);
    expect(playing.offsetSeconds).toBe(2);
    expect(playing.changedAtEpochMs).toBe(EPOCH + 5_000);
    expect(playing.revision).toBe(3);
    expect(expectedOffsetSeconds(playing, EPOCH + 8_000)).toBe(5);
    expect(playPlayback(playing, EPOCH + 9_000)).toBe(playing);
  });

  it("restart vuelve al inicio, reproduce e incrementa revisión", () => {
    const paused = pausePlayback(createInitialPlayback(EPOCH), EPOCH + 2_000);
    expect(restartPlayback(paused, EPOCH + 4_000)).toEqual({
      ...paused,
      state: "playing",
      offsetSeconds: 0,
      changedAtEpochMs: EPOCH + 4_000,
      revision: 3,
    });
  });

  it("activa y desactiva loop incrementando la revisión", () => {
    const initial = createInitialPlayback(EPOCH);
    const looped = togglePlaybackLoop(initial);
    const unlooped = togglePlaybackLoop(looped);
    expect(looped.loop).toBe(true);
    expect(looped.revision).toBe(2);
    expect(unlooped.loop).toBe(false);
    expect(unlooped.revision).toBe(3);
  });

  it("envuelve la posición por duración cuando loop está activo", () => {
    const looped = togglePlaybackLoop(createInitialPlayback(EPOCH));
    expect(expectedOffsetSeconds(looped, EPOCH + 12_500, 10)).toBe(2.5);
  });

  it("un Output abierto tarde deriva la posición desde changedAtEpochMs", () => {
    const snapshotPlayback = createInitialPlayback(EPOCH);
    expect(expectedOffsetSeconds(snapshotPlayback, EPOCH + 45_000)).toBe(45);
  });

  it("un snapshot demorado conserva el epoch y no reinicia el video", () => {
    const sentAt = EPOCH + 3_000;
    const playback = pausePlayback(createInitialPlayback(EPOCH), sentAt);
    const receivedAt = sentAt + 20_000;
    expect(playback.changedAtEpochMs).toBe(sentAt);
    expect(expectedOffsetSeconds(playback, receivedAt)).toBe(3);
  });

  it("corrige sólo cuando la deriva supera 0,35 segundos", () => {
    expect(shouldCorrectVideoDrift(10, 10.35)).toBe(false);
    expect(shouldCorrectVideoDrift(10, 10.351)).toBe(true);
    expect(shouldCorrectVideoDrift(10.4, 10)).toBe(true);
  });

  it("Clear y Black no cambian la slide ni la timeline", () => {
    const item: PresentationItem = {
      id: "video-item",
      type: "media",
      title: "Video",
      order: 0,
      slides: [
        {
          id: "video-slide",
          itemId: "video-item",
          order: 0,
          content: { kind: "video", mediaId: "media-1" },
        },
      ],
    };
    const live = goLive(loadPresentation(createInitialPresentationState(), [item]), "video-slide");
    const playback = createInitialPlayback(EPOCH);
    const clear = setProgramMode(live, "clear");
    const black = setProgramMode(live, "black");

    expect(getProgramSlide(clear)?.id).toBe("video-slide");
    expect(getProgramSlide(black)?.id).toBe("video-slide");
    expect(expectedOffsetSeconds(playback, EPOCH + 7_000)).toBe(7);
  });
});
