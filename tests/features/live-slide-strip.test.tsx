import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MediaProvider } = await import("@/features/media/media-context");
const { LiveSlideStrip } = await import("@/features/live/components/live-slide-strip");
const { createPresentationStore } = await import("@/stores/presentation-store");
const { createInMemoryMediaRepository } =
  await import("@/services/media/in-memory-media-repository");
const { createInMemoryMediaStorage } = await import("@/services/media/in-memory-media-storage");

const item = {
  id: "song-item",
  type: "song" as const,
  title: "Santo",
  order: 0,
  slides: [
    {
      id: "song-item:verse",
      itemId: "song-item",
      order: 0,
      label: "Verso 1",
      content: { kind: "text" as const, lines: ["Santo, santo"] },
      secondaryText: "Referencia",
      background: {
        type: "media" as const,
        mediaId: "video-bg",
        kind: "video" as const,
        fallbackColor: "#0B0D10",
      },
    },
    {
      id: "song-item:media",
      itemId: "song-item",
      order: 1,
      content: { kind: "video" as const, mediaId: "content-video" },
      background: { type: "solid" as const, color: "#0B0D10" },
    },
  ],
};

describe("LiveSlideStrip visual thumbnails", () => {
  it("keeps Preview and Program indicators outside the visual surface", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(LiveSlideStrip, {
          item,
          previewSlideId: "song-item:verse",
          programSlideId: "song-item:verse",
          backgroundThumbnails: new Map([["video-bg", "data:image/jpeg;base64,STATIC"]]),
          onSelect: () => undefined,
          onTake: () => undefined,
        }),
      );
    });

    const card = container.querySelector("button");
    const surface = card?.querySelector('[data-testid="slide-thumbnail-surface"]');
    expect(card?.textContent).toContain("Program");
    expect(card?.textContent).toContain("Preview");
    expect(surface?.textContent).not.toContain("Program");
    expect(surface?.textContent).not.toContain("Preview");
    expect(container.querySelectorAll("video")).toHaveLength(0);
    expect(container.querySelector('img[src="data:image/jpeg;base64,STATIC"]')).not.toBeNull();
    expect(card?.className).toContain("aspect-video");
    expect(card?.className).not.toContain("h-full");

    await act(async () => root.unmount());
  });

  it("selects on one click, takes explicitly, and preserves Media card semantics", async () => {
    const selections: string[] = [];
    const takes: string[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(LiveSlideStrip, {
          item,
          previewSlideId: null,
          programSlideId: null,
          backgroundThumbnails: new Map(),
          onSelect: (slideId: string) => selections.push(slideId),
          onTake: (slideId: string) => takes.push(slideId),
        }),
      );
    });

    const buttons = container.querySelectorAll("button");
    await act(async () => buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(selections).toEqual(["song-item:verse"]);
    expect(takes).toEqual([]);
    await act(async () => buttons[0]?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(takes).toEqual(["song-item:verse"]);
    expect(buttons[1]?.textContent).toContain("Video");
    expect(buttons[1]?.querySelector('[data-testid="slide-thumbnail-surface"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it("does not request Media bytes or object URLs for thumbnail cards", async () => {
    const storage = createInMemoryMediaStorage();
    let getCalls = 0;
    let getUrlCalls = 0;
    const originalGet = storage.get.bind(storage);
    const originalGetUrl = storage.getUrl.bind(storage);
    storage.get = async (id) => {
      getCalls += 1;
      return originalGet(id);
    };
    storage.getUrl = async (id) => {
      getUrlCalls += 1;
      return originalGetUrl(id);
    };

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
          React.createElement(LiveSlideStrip, {
            item,
            previewSlideId: null,
            programSlideId: null,
            backgroundThumbnails: new Map([["video-bg", "data:image/jpeg;base64,STATIC"]]),
            onSelect: () => undefined,
            onTake: () => undefined,
          }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getCalls).toBe(0);
    expect(getUrlCalls).toBe(0);
    await act(async () => root.unmount());
  });

  it("takes the focused slide on Enter and Space without taking the previous selection", async () => {
    const store = createPresentationStore();
    store.loadPresentation([item]);
    store.take();
    const globalKeys: string[] = [];
    const onWindowKeyDown = () => {
      globalKeys.push("global");
    };
    window.addEventListener("keydown", onWindowKeyDown);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(LiveSlideStrip, {
          item,
          previewSlideId: null,
          programSlideId: null,
          onSelect: (slideId: string) => store.selectSlide(slideId),
          onTake: (slideId: string) => {
            store.selectSlide(slideId);
            store.take();
          },
        }),
      );
    });

    const target = container.querySelectorAll("button")[1];
    store.selectSlide("song-item:verse");
    await act(async () =>
      target?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(store.getState().previewSlideId).toBe("song-item:media");
    expect(store.getState().programSlideId).toBe("song-item:media");

    store.selectSlide("song-item:verse");
    await act(async () =>
      target?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })),
    );
    expect(store.getState().previewSlideId).toBe("song-item:media");
    expect(store.getState().programSlideId).toBe("song-item:media");
    expect(globalKeys).toEqual([]);
    expect(container.querySelector('[data-testid="live-slide-strip"]')).not.toBeNull();

    window.removeEventListener("keydown", onWindowKeyDown);
    await act(async () => root.unmount());
  });
});
