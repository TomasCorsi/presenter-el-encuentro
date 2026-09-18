import { describe, expect, it } from "bun:test";

import {
  OUTPUT_MAIN_PATH,
  OUTPUT_WINDOW_NAME,
  openOutputWindow,
  rectFromScreen,
  type OpenWindowFn,
  type OutputWindowLike,
} from "@/features/output/open-output-window";
import type { ScreenInfo } from "@/services/display/window-management";

const projector: ScreenInfo = {
  label: "BenQ",
  width: 1280,
  height: 720,
  availWidth: 1280,
  availHeight: 700,
  availLeft: 1920,
  availTop: 0,
  devicePixelRatio: 1,
  isPrimary: false,
};

function fakeWindow(overrides: Partial<OutputWindowLike> = {}) {
  const calls: string[] = [];
  const target: OutputWindowLike = {
    closed: false,
    moveTo: (x, y) => calls.push(`moveTo:${x},${y}`),
    resizeTo: (w, h) => calls.push(`resizeTo:${w},${h}`),
    focus: () => calls.push("focus"),
    ...overrides,
  };
  return { target, calls };
}

describe("openOutputWindow", () => {
  it("abre la salida sobre la pantalla configurada y le da foco", () => {
    const { target, calls } = fakeWindow();
    const seen: Array<[string, string, string]> = [];
    const open: OpenWindowFn = (url, name, features) => {
      seen.push([url, name, features]);
      return target;
    };

    const result = openOutputWindow({ rect: rectFromScreen(projector), open });

    expect(result.status).toBe("opened");
    expect(seen[0]![0]).toBe(OUTPUT_MAIN_PATH);
    expect(seen[0]![1]).toBe(OUTPUT_WINDOW_NAME);
    expect(seen[0]![2]).toContain("left=1920");
    expect(seen[0]![2]).toContain("width=1280");
    expect(calls).toEqual(["moveTo:1920,0", "resizeTo:1280,700", "focus"]);
  });

  it("reutiliza la misma ventana en lugar de duplicar la salida", () => {
    const { target } = fakeWindow();
    const names: string[] = [];
    const open: OpenWindowFn = (_url, name) => {
      names.push(name);
      return target;
    };

    const first = openOutputWindow({ rect: rectFromScreen(projector), open });
    const second = openOutputWindow({ rect: rectFromScreen(projector), open });

    expect(names).toEqual([OUTPUT_WINDOW_NAME, OUTPUT_WINDOW_NAME]);
    expect(first.status === "opened" && second.status === "opened").toBe(true);
    expect(first.status === "opened" && first.window).toBe(target);
  });

  it("informa el bloqueo cuando el navegador no devuelve ventana", () => {
    const result = openOutputWindow({ rect: null, open: () => null });
    expect(result.status).toBe("blocked");
  });

  it("abre sin geometría en el modo alternativo", () => {
    const { target, calls } = fakeWindow();
    const features: string[] = [];
    openOutputWindow({
      rect: null,
      open: (_url, _name, feature) => {
        features.push(feature);
        return target;
      },
    });
    expect(features[0]).toBe("popup=yes");
    expect(calls).toEqual(["focus"]);
  });

  it("no rompe cuando el navegador prohíbe mover la ventana", () => {
    const { target } = fakeWindow({
      moveTo: () => {
        throw new Error("bloqueado por el navegador");
      },
    });
    const result = openOutputWindow({ rect: rectFromScreen(projector), open: () => target });
    expect(result.status).toBe("opened");
  });
});
