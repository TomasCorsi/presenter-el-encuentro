import { describe, expect, it } from "bun:test";

import {
  AUDIENCE_SCREEN_KEY,
  clearAudienceScreen,
  readAudienceScreen,
  writeAudienceScreen,
} from "@/services/display/display-preference";
import {
  fingerprintScreen,
  matchScreen,
  suggestAudienceScreen,
  type ScreenInfo,
} from "@/services/display/window-management";

function screen(overrides: Partial<ScreenInfo> = {}): ScreenInfo {
  return {
    label: "Pantalla interna",
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    availLeft: 0,
    availTop: 0,
    devicePixelRatio: 1,
    isPrimary: true,
    ...overrides,
  };
}

const projector = screen({
  label: "BenQ",
  availLeft: 1920,
  width: 1280,
  height: 720,
  availWidth: 1280,
  availHeight: 720,
  isPrimary: false,
});

/** localStorage mínimo, suficiente para la preferencia local. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

describe("matchScreen", () => {
  it("reconoce la pantalla guardada cuando coincide exactamente", () => {
    const match = matchScreen(fingerprintScreen(projector), [screen(), projector]);
    expect(match).toEqual({ status: "exact", index: 1 });
  });

  it("reconoce la pantalla por resolución y posición cuando cambió el resto", () => {
    const moved = { ...projector, label: "", devicePixelRatio: 1.25 };
    const match = matchScreen(fingerprintScreen(projector), [screen(), moved]);
    expect(match.index).toBe(1);
  });

  it("no elige nada cuando hay dos candidatas idénticas", () => {
    const twin = { ...projector, label: "" };
    const match = matchScreen(
      fingerprintScreen({ ...projector, label: "" }),
      [twin, { ...twin }],
    );
    expect(match).toEqual({ status: "ambiguous", index: null });
  });

  it("no cae nunca en la pantalla principal cuando el proyector no está", () => {
    const match = matchScreen(fingerprintScreen(projector), [screen()]);
    expect(match).toEqual({ status: "missing", index: null });
  });
});

describe("suggestAudienceScreen", () => {
  it("propone la pantalla no principal cuando hay exactamente dos", () => {
    expect(suggestAudienceScreen([screen(), projector])).toBe(1);
  });

  it("no propone nada con una sola pantalla", () => {
    expect(suggestAudienceScreen([screen()])).toBeNull();
  });

  it("no propone nada con tres pantallas", () => {
    expect(suggestAudienceScreen([screen(), projector, { ...projector, availLeft: 3200 }])).toBeNull();
  });
});

describe("preferencia de pantalla", () => {
  it("guarda y vuelve a leer la huella del proyector", () => {
    const storage = memoryStorage();
    writeAudienceScreen(storage, fingerprintScreen(projector));
    expect(readAudienceScreen(storage)).toEqual(fingerprintScreen(projector));
  });

  it("ignora datos corruptos sin lanzar", () => {
    const storage = memoryStorage({ [AUDIENCE_SCREEN_KEY]: "{{" });
    expect(readAudienceScreen(storage)).toBeNull();
  });

  it("olvida la configuración", () => {
    const storage = memoryStorage();
    writeAudienceScreen(storage, fingerprintScreen(projector));
    clearAudienceScreen(storage);
    expect(readAudienceScreen(storage)).toBeNull();
  });
});
