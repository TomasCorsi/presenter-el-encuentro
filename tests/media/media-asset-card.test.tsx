import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MediaAssetCard } = await import("@/features/media/components/media-asset-card");

const video = {
  id: "video-1",
  workspaceId: "local-media",
  name: "Loop",
  kind: "video" as const,
  mimeType: "video/mp4",
  sizeBytes: 10,
  storage: "opfs" as const,
  thumbnailDataUrl: "data:image/jpeg;base64,AA==",
  tags: ["loop"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  presentationUpdatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MediaAssetCard", () => {
  it("representa videos sólo con thumbnail metadata, sin montar decoder", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(MediaAssetCard, {
          asset: video,
          viewMode: "grid",
          favorite: false,
          selectionMode: false,
          selected: false,
          onOpen: () => undefined,
          onToggleFavorite: () => undefined,
          onToggleSelected: () => undefined,
          onDelete: () => undefined,
        }),
      );
    });
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(video.thumbnailDataUrl);
    await act(async () => root.unmount());
  });
});
