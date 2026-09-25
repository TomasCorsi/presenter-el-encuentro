import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, it } from "bun:test";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LiveOperationBar } = await import("@/features/live/components/live-operation-bar");

describe("Live compact controls", () => {
  it("keeps every operational action visible in short mode", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(LiveOperationBar, {
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
          compact: true,
          short: true,
        }),
      );
    });

    for (const label of ["Previous", "Next", "TAKE", "Clear", "Black", "Buscar"]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).not.toContain("← anterior");
    await act(async () => root.unmount());
  });
});
