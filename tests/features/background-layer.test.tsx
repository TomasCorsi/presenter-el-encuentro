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
    expect(video?.playsInline).toBe(true);
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
