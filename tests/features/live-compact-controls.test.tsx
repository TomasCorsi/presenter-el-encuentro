import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LiveOperatorToolbar } = await import("@/features/live/components/live-operator-toolbar");

describe("Live compact controls", () => {
  it("keeps every operational action visible in short mode", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(LiveOperatorToolbar, {
          showName: "Servicio",
          itemCount: 4,
          outdated: false,
          activeProjectName: null,
          outputStatus: "open",
          outputMessage: null,
          stageOutputStatus: "closed",
          stageOutputMessage: null,
          streamOutputStatus: "closed",
          streamOutputMessage: null,
          streamRelayStatus: "connected",
          fullscreenSupported: true,
          fullscreen: false,
          fullscreenError: null,
          canPrevious: true,
          canNext: true,
          canTake: true,
          programMode: "content",
          onPrevious: () => undefined,
          onNext: () => undefined,
          onTake: () => undefined,
          onToggleMode: () => undefined,
          onSearch: () => undefined,
          libraryOpen: true,
          onReload: () => undefined,
          onLoadActiveProject: () => undefined,
          onOpenOutput: () => undefined,
          onOpenStage: () => undefined,
          onOpenStream: () => undefined,
          onToggleFullscreen: () => undefined,
          compact: true,
          short: true,
        }),
      );
    });

    for (const label of ["Previous", "Next", "TAKE", "Clear", "Black", "Buscar"]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toContain("Servicio");
    expect(container.querySelector('[aria-label="Output abierto"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Abrir salidas"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Pantalla completa"]')).not.toBeNull();
    expect(container.textContent).not.toContain("← anterior");
    await act(async () => root.unmount());
  });
});
