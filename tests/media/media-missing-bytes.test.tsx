import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MediaProvider } = await import("@/features/media/media-context");
const { MediaSlideSurface } =
  await import("@/features/presentation/components/media-slide-surface");
const { createInMemoryMediaRepository } =
  await import("@/services/media/in-memory-media-repository");
const { createInMemoryMediaStorage } = await import("@/services/media/in-memory-media-storage");

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Media con metadata pero bytes ausentes", () => {
  it("muestra un placeholder neutro", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          MediaProvider,
          {
            repository: createInMemoryMediaRepository(),
            fileStorage: createInMemoryMediaStorage(),
            initialAssets: [
              {
                id: "missing",
                workspaceId: "local-media",
                name: "Falta",
                kind: "image",
                mimeType: "image/png",
                sizeBytes: 10,
                storage: "memory",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
          React.createElement(MediaSlideSurface, { mediaId: "missing", kind: "image" }),
        ),
      );
    });
    await flush();
    expect(container.textContent).toContain("Este archivo no está disponible en este dispositivo");

    await act(async () => root.unmount());
    container.remove();
  });
});
