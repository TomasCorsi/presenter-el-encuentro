import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import type { OutputSnapshot, StageProjection } from "@/domain/output/output-snapshot";
import { StageDisplay } from "@/features/output/components/stage-display";
import {
  formatStageClock,
  STAGE_CLOCK_PLACEHOLDER,
  useStageClock,
} from "@/features/output/use-stage-clock";
import { stageSnapshotForDisplay } from "@/features/output/use-stage-output-state";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

const stage: StageProjection = {
  current: {
    slideId: "b1",
    itemId: "bible",
    itemTitle: "Juan 3:16",
    itemType: "bible",
    label: "Versículo 16",
    content: { kind: "text", lines: ["Porque de tal manera amó Dios"] },
    secondaryText: "Juan 3:16 · NVI",
  },
  next: {
    slideId: "m1",
    itemId: "media",
    itemTitle: "Bienvenida",
    itemType: "media",
    content: { kind: "video", mediaId: "media-1" },
  },
};

function snapshot(mode: OutputSnapshot["mode"] = "content"): OutputSnapshot {
  return {
    sessionId: "live-a",
    sequence: 4,
    mode,
    backgroundTransition: "cut",
    slide: null,
    stage,
  };
}

describe("StageDisplay", () => {
  it("muestra current, referencia, siguiente item y thumbnail Media sin montar video", () => {
    const html = renderToStaticMarkup(
      <StageDisplay
        snapshot={snapshot()}
        connection="connected"
        clock="20:41:32"
        assets={[
          {
            id: "media-1",
            workspaceId: "local-media",
            name: "Bienvenida",
            kind: "video",
            mimeType: "video/mp4",
            sizeBytes: 10,
            storage: "opfs",
            thumbnailDataUrl: "data:image/jpeg;base64,AA==",
            tags: [],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            presentationUpdatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Porque de tal manera amó Dios");
    expect(html).toContain("Juan 3:16 · NVI");
    expect(html).toContain("Bienvenida");
    expect(html).toContain("VIDEO");
    expect(html).toContain('src="data:image/jpeg;base64,AA=="');
    expect(html).not.toContain("<video");
    expect(html).toContain("LIVE");
    expect(html).toContain("20:41:32");
  });

  it("mantiene las cues visibles bajo Clear y Black", () => {
    for (const mode of ["clear", "black"] as const) {
      const html = renderToStaticMarkup(
        <StageDisplay snapshot={snapshot(mode)} connection="connected" clock="10:00:00" />,
      );
      expect(html).toContain(mode.toUpperCase());
      expect(html).toContain("Porque de tal manera amó Dios");
      expect(html).toContain("Bienvenida");
    }
  });

  it("muestra stale conservando el último snapshot", () => {
    const last = snapshot();
    const retained = stageSnapshotForDisplay(null, last);
    const html = renderToStaticMarkup(
      <StageDisplay snapshot={retained} connection="disconnected" clock="10:00:00" />,
    );
    expect(retained).toBe(last);
    expect(html).toContain("STALE · RECONECTANDO");
    expect(html).toContain("Porque de tal manera amó Dios");
  });
});

describe("Stage clock", () => {
  it("formatea HH:mm:ss y mantiene placeholder SSR estable", () => {
    expect(formatStageClock(new Date(2026, 9, 13, 7, 5, 9))).toBe("07:05:09");
    expect(STAGE_CLOCK_PLACEHOLDER).toBe("--:--:--");
  });

  it("actualiza una vez por tick y limpia el intervalo", async () => {
    let current = new Date(2026, 9, 13, 7, 5, 9);
    let tick: (() => void) | null = null;
    let cleared = false;
    const setIntervalFn = ((callback: () => void, ms: number) => {
      expect(ms).toBe(1000);
      tick = callback;
      return 1;
    }) as unknown as typeof setInterval;
    const clearIntervalFn = (() => {
      cleared = true;
    }) as unknown as typeof clearInterval;

    function ClockHarness() {
      return <span>{useStageClock({ now: () => current, setIntervalFn, clearIntervalFn })}</span>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<ClockHarness />));
    expect(container.textContent).toBe("07:05:09");
    current = new Date(2026, 9, 13, 7, 5, 10);
    await act(async () => tick?.());
    expect(container.textContent).toBe("07:05:10");
    await act(async () => root.unmount());
    expect(cleared).toBe(true);
  });
});
