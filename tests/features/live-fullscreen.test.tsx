import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it, mock } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useLiveFullscreen } = await import("@/features/live/use-live-fullscreen");

let currentFullscreenElement: Element | null = null;

function configureFullscreen(options?: {
  enabled?: boolean;
  request?: () => Promise<void>;
  exit?: () => Promise<void>;
}) {
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: options?.enabled ?? true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => currentFullscreenElement,
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: options?.request ?? (async () => undefined),
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: options?.exit ?? (async () => undefined),
  });
}

function Harness() {
  const fullscreen = useLiveFullscreen();
  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      { disabled: !fullscreen.supported, onClick: () => void fullscreen.toggle() },
      fullscreen.fullscreen ? "Salir" : "Entrar",
    ),
    React.createElement("span", { role: "status" }, fullscreen.error ?? "ok"),
  );
}

async function mountHarness() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(Harness)));
  return { container, root, button: container.querySelector("button") as HTMLButtonElement };
}

describe("Live native fullscreen", () => {
  it("requests fullscreen from a direct click", async () => {
    currentFullscreenElement = null;
    const request = mock(async () => undefined);
    configureFullscreen({ request });
    const mounted = await mountHarness();
    await act(async () => mounted.button.click());
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => mounted.root.unmount());
  });

  it("exits when fullscreen is already active", async () => {
    currentFullscreenElement = document.documentElement;
    const exit = mock(async () => undefined);
    configureFullscreen({ exit });
    const mounted = await mountHarness();
    expect(mounted.button.textContent).toBe("Salir");
    await act(async () => mounted.button.click());
    expect(exit).toHaveBeenCalledTimes(1);
    await act(async () => mounted.root.unmount());
  });

  it("tracks fullscreenchange including an ESC exit", async () => {
    currentFullscreenElement = null;
    configureFullscreen();
    const mounted = await mountHarness();
    currentFullscreenElement = document.documentElement;
    await act(async () => document.dispatchEvent(new Event("fullscreenchange")));
    expect(mounted.button.textContent).toBe("Salir");
    currentFullscreenElement = null;
    await act(async () => document.dispatchEvent(new Event("fullscreenchange")));
    expect(mounted.button.textContent).toBe("Entrar");
    await act(async () => mounted.root.unmount());
  });

  it("reports fullscreenerror without breaking the workspace", async () => {
    currentFullscreenElement = null;
    configureFullscreen();
    const mounted = await mountHarness();
    await act(async () => document.dispatchEvent(new Event("fullscreenerror")));
    expect(mounted.container.querySelector('[role="status"]')?.textContent).toContain(
      "no pudo activar",
    );
    expect(mounted.button.disabled).toBe(false);
    await act(async () => mounted.root.unmount());
  });

  it("handles unsupported browsers and rejected requests", async () => {
    currentFullscreenElement = null;
    configureFullscreen({ enabled: false });
    let mounted = await mountHarness();
    expect(mounted.button.disabled).toBe(true);
    await act(async () => mounted.root.unmount());

    configureFullscreen({ request: async () => Promise.reject(new Error("denied")) });
    mounted = await mountHarness();
    await act(async () => mounted.button.click());
    expect(mounted.container.querySelector('[role="status"]')?.textContent).toContain(
      "no pudo activar",
    );
    await act(async () => mounted.root.unmount());
  });

  it("cleans fullscreen listeners on unmount", async () => {
    currentFullscreenElement = null;
    configureFullscreen();
    const originalAdd = document.addEventListener.bind(document);
    const originalRemove = document.removeEventListener.bind(document);
    const added: string[] = [];
    const removed: string[] = [];
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type.startsWith("fullscreen")) added.push(type);
      originalAdd(type, listener);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type.startsWith("fullscreen")) removed.push(type);
      originalRemove(type, listener);
    }) as typeof document.removeEventListener;

    const mounted = await mountHarness();
    await act(async () => mounted.root.unmount());
    document.addEventListener = originalAdd;
    document.removeEventListener = originalRemove;
    expect(added).toEqual(["fullscreenchange", "fullscreenerror"]);
    expect(removed).toEqual(added);
  });
});
