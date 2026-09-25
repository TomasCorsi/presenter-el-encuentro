import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MediaProvider } = await import("@/features/media/media-context");
const { BackgroundLayer } = await import("@/features/presentation/components/background-layer");
const { createInMemoryMediaRepository } =
  await import("@/services/media/in-memory-media-repository");
const { createInMemoryMediaStorage } = await import("@/services/media/in-memory-media-storage");

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("BackgroundLayer", () => {
  it("does not replay a fade on mount and crossfades only a real background change", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const storage = createInMemoryMediaStorage();
    const render = (color: string, transition: "cut" | "fade") =>
      React.createElement(
        MediaProvider,
        {
          repository: createInMemoryMediaRepository(),
          fileStorage: storage,
          initialAssets: [],
        },
        React.createElement(BackgroundLayer, {
          background: { type: "solid", color },
          transition,
        }),
      );

    await act(async () => root.render(render("#111111", "fade")));
    expect(container.querySelector('[data-testid="background-layer"]')?.children).toHaveLength(1);

    await act(async () => root.render(render("#222222", "fade")));
    const fading = container.querySelector('[data-testid="background-layer"]');
    expect(fading?.children).toHaveLength(2);
    expect(fading?.innerHTML).toContain("#111111");
    expect(fading?.innerHTML).toContain("#222222");

    await act(async () => root.render(render("#333333", "cut")));
    const cut = container.querySelector('[data-testid="background-layer"]');
    expect(cut?.children).toHaveLength(1);
    expect(cut?.innerHTML).toContain("#333333");
    await act(async () => root.unmount());
  });

  it("video backgrounds are muted looping autoplay surfaces", async () => {
    const storage = createInMemoryMediaStorage();
    await storage.save("video-1", new Blob(["video"], { type: "video/mp4" }));
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          MediaProvider,
          {
            repository: createInMemoryMediaRepository(),
            fileStorage: storage,
            initialAssets: [],
          },
          React.createElement(BackgroundLayer, {
            background: {
              type: "media",
              mediaId: "video-1",
              kind: "video",
              fallbackColor: "#123456",
            },
          }),
        ),
      );
    });
    await flush();

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(video?.controls).toBe(false);

    await act(async () => root.unmount());
  });

  it("missing bytes leave the Preset fallback color visible", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(
          MediaProvider,
          {
            repository: createInMemoryMediaRepository(),
            fileStorage: createInMemoryMediaStorage(),
            initialAssets: [],
          },
          React.createElement(BackgroundLayer, {
            background: {
              type: "media",
              mediaId: "missing",
              kind: "image",
              fallbackColor: "#654321",
            },
          }),
        ),
      );
    });
    await flush();
    expect(container.querySelector("img,video")).toBeNull();
    expect(container.innerHTML).toContain("#654321");
    await act(async () => root.unmount());
  });
});
