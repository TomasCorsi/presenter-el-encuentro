import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act, createRef } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LiveLibraryDock } = await import("@/features/live/components/live-library-dock");
const { LibraryDockResizeHandle } =
  await import("@/features/live/components/library-dock-resize-handle");
const {
  LIBRARY_DOCK_HEIGHT_KEY,
  LIBRARY_DOCK_DEFAULT_HEIGHT,
  LIBRARY_DOCK_MIN_HEIGHT,
  clampLibraryDockHeight,
  getLibraryDockBounds,
  libraryDockHeightFromDrag,
  parseLibraryDockPreference,
  persistLibraryDockPreference,
  readLibraryDockPreference,
} = await import("@/features/live/library-dock-height");

const desktopBounds = getLibraryDockBounds({
  viewportHeight: 1080,
  availableHeight: 900,
  density: "desktop",
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function pointer(type: string, clientY: number, pointerId = 1): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientY,
    isPrimary: true,
    pointerId,
  });
}

function handleElement(container: HTMLElement): HTMLDivElement {
  const handle = container.querySelector<HTMLDivElement>('[aria-label="Redimensionar biblioteca"]');
  if (!handle) throw new Error("Resize handle no encontrado");
  return handle;
}

describe("Library Dock height preference", () => {
  it("uses the initial default height", () => {
    expect(parseLibraryDockPreference(null, LIBRARY_DOCK_DEFAULT_HEIGHT.desktop)).toBe(240);
  });

  it("restores a valid height from localStorage", () => {
    const storage = memoryStorage();
    storage.setItem(LIBRARY_DOCK_HEIGHT_KEY, "318");
    expect(readLibraryDockPreference(storage, LIBRARY_DOCK_DEFAULT_HEIGHT.desktop)).toBe(318);
  });

  it("clamps effective values without overwriting the preferred height", () => {
    const compactBounds = getLibraryDockBounds({
      viewportHeight: 768,
      availableHeight: 600,
      density: "compact",
    });
    expect(parseLibraryDockPreference("20", LIBRARY_DOCK_DEFAULT_HEIGHT.compact)).toBe(
      LIBRARY_DOCK_MIN_HEIGHT,
    );
    expect(parseLibraryDockPreference("9999", 190)).toBe(9999);
    expect(clampLibraryDockHeight(9999, compactBounds)).toBe(compactBounds.max);
    expect(clampLibraryDockHeight(Number.NaN, compactBounds)).toBe(190);
  });

  it("recovers the preferred height when the viewport grows", () => {
    const preferred = 420;
    const small = getLibraryDockBounds({
      viewportHeight: 720,
      availableHeight: 540,
      density: "short",
    });
    const large = getLibraryDockBounds({
      viewportHeight: 1080,
      availableHeight: 900,
      density: "desktop",
    });
    expect(clampLibraryDockHeight(preferred, small)).toBeLessThan(preferred);
    expect(clampLibraryDockHeight(preferred, large)).toBe(preferred);
  });

  it("collapse does not erase the height and reopen restores it", async () => {
    const storage = memoryStorage();
    persistLibraryDockPreference(storage, 320);
    const container = document.createElement("div");
    const root = createRoot(container);
    let toggles = 0;
    const render = (open: boolean) =>
      React.createElement(LiveLibraryDock, {
        open,
        onToggle: () => {
          toggles += 1;
        },
        height: clampLibraryDockHeight(
          readLibraryDockPreference(storage, LIBRARY_DOCK_DEFAULT_HEIGHT.desktop),
          desktopBounds,
        ),
        heightBounds: desktopBounds,
        onHeightChange: () => undefined,
        onHeightCommit: () => undefined,
        onHeightCancel: () => undefined,
        onHeightReset: () => undefined,
        tab: "songs" as const,
        onTabChange: () => undefined,
        inputRef: createRef<HTMLInputElement>(),
        songs: [],
        bibleVersionId: null,
        onBibleVersionChange: () => undefined,
        mediaAssets: [],
        mediaLoading: false,
        canAdd: false,
        busy: false,
        status: null,
        onAddSong: () => undefined,
        onAddPassage: () => undefined,
        onAddMedia: () => undefined,
        backgroundTarget: null,
        onBackgroundTransitionChange: () => undefined,
        onApplyBackground: async () => false,
      });

    await act(async () => root.render(render(false)));
    const toggle = container.querySelector<HTMLButtonElement>(
      '[aria-controls="live-library-panel"]',
    );
    await act(async () => toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggles).toBe(1);
    expect(storage.getItem(LIBRARY_DOCK_HEIGHT_KEY)).toBe("320");

    await act(async () => root.render(render(true)));
    expect(container.querySelector<HTMLElement>("#live-library-dock")?.style.height).toBe("320px");
    expect(handleElement(container)).not.toBeNull();
    await act(async () => root.unmount());
  });
});

describe("LibraryDockResizeHandle", () => {
  async function renderHandle() {
    const changes: number[] = [];
    const commits: number[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(LibraryDockResizeHandle, {
          height: 240,
          bounds: desktopBounds,
          onHeightChange: (height: number) => changes.push(height),
          onHeightCommit: (height: number) => commits.push(height),
          onHeightCancel: () => undefined,
          onReset: () => undefined,
        }),
      );
    });
    return { changes, commits, container, root, handle: handleElement(container) };
  }

  it("dragging upward increases height", async () => {
    expect(libraryDockHeightFromDrag(240, 400, 340, desktopBounds)).toBe(300);
    const rendered = await renderHandle();
    await act(async () => rendered.handle.dispatchEvent(pointer("pointerdown", 400)));
    await act(async () => window.dispatchEvent(pointer("pointermove", 340)));
    await act(async () => window.dispatchEvent(pointer("pointerup", 340)));
    expect(rendered.changes.at(-1)).toBe(300);
    expect(rendered.commits).toEqual([300]);
    await act(async () => rendered.root.unmount());
  });

  it("dragging downward reduces height", async () => {
    expect(libraryDockHeightFromDrag(240, 300, 350, desktopBounds)).toBe(190);
    const rendered = await renderHandle();
    await act(async () => rendered.handle.dispatchEvent(pointer("pointerdown", 300)));
    await act(async () => window.dispatchEvent(pointer("pointermove", 350)));
    await act(async () => window.dispatchEvent(pointer("pointerup", 350)));
    expect(rendered.changes.at(-1)).toBe(190);
    expect(rendered.commits).toEqual([190]);
    await act(async () => rendered.root.unmount());
  });

  it("double click resets to the current profile default", async () => {
    let resets = 0;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(LibraryDockResizeHandle, {
          height: 320,
          bounds: desktopBounds,
          onHeightChange: () => undefined,
          onHeightCommit: () => undefined,
          onHeightCancel: () => undefined,
          onReset: () => {
            resets += 1;
          },
        }),
      );
    });
    await act(async () =>
      handleElement(container).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(resets).toBe(1);
    expect(handleElement(container).title).toContain("240px");
    await act(async () => root.unmount());
  });

  it("cleans pointer listeners and body selection state on unmount", async () => {
    const rendered = await renderHandle();
    const previousUserSelect = document.body.style.userSelect;
    await act(async () => rendered.handle.dispatchEvent(pointer("pointerdown", 300)));
    expect(document.body.style.userSelect).toBe("none");
    await act(async () => rendered.root.unmount());
    expect(document.body.style.userSelect).toBe(previousUserSelect);
    const changeCount = rendered.changes.length;
    await act(async () => window.dispatchEvent(pointer("pointermove", 200)));
    expect(rendered.changes).toHaveLength(changeCount);
  });
});
