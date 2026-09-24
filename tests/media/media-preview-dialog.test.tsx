import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MediaProvider } = await import("@/features/media/media-context");
const { MediaPreviewDialog } = await import("@/features/media/components/media-preview-dialog");
const { createInMemoryMediaRepository } =
  await import("@/services/media/in-memory-media-repository");
const { createInMemoryMediaStorage } = await import("@/services/media/in-memory-media-storage");

const asset = {
  id: "video-1",
  workspaceId: "local-media",
  name: "Preview",
  kind: "video" as const,
  mimeType: "video/mp4",
  sizeBytes: 5,
  storage: "memory" as const,
  durationSeconds: 30,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MediaPreviewDialog", () => {
  it("starts muted and closing pauses and rewinds the local video", async () => {
    const storage = createInMemoryMediaStorage();
    await storage.save(asset.id, new Blob(["video"], { type: asset.mimeType }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const render = (open: boolean) =>
      React.createElement(
        MediaProvider,
        {
          repository: createInMemoryMediaRepository(),
          fileStorage: storage,
          initialAssets: [asset],
        },
        React.createElement(MediaPreviewDialog, {
          asset,
          open,
          onOpenChange: () => undefined,
        }),
      );

    await act(async () => root.render(render(true)));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    const video = document.querySelector("video") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    if (video) video.currentTime = 8;

    await act(async () => root.render(render(false)));
    expect(video?.currentTime).toBe(0);
    expect(video?.paused).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
