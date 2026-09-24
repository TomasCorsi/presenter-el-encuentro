import { describe, expect, it } from "bun:test";

import {
  parseOutputMessage,
  snapshotsEqual,
  toOutputSnapshot,
  type OutputSnapshot,
  type OutputSlide,
} from "@/domain/output/output-snapshot";
import { createInitialPlayback } from "@/domain/output/video-playback";
import { DEFAULT_PRESET_STYLE } from "@/domain/presets/preset";

function textSlide(
  lines: string[],
  style = DEFAULT_PRESET_STYLE,
  id = "song:1:slide:0",
): OutputSlide {
  return {
    id,
    content: { kind: "text", lines: [...lines] },
    style,
    background: { type: "solid", color: style.background.color },
  };
}

function snapshot(overrides: Partial<OutputSnapshot> = {}): OutputSnapshot {
  return {
    sessionId: "session-a",
    sequence: 0,
    mode: "content",
    backgroundTransition: "cut",
    slide: textSlide(["Línea uno", "Línea dos"]),
    ...overrides,
  };
}

describe("toOutputSnapshot", () => {
  it("resuelve la slide con sus líneas", () => {
    const result = toOutputSnapshot(
      {
        mode: "content",
        slide: {
          id: "song:1:slide:0",
          itemId: "song:1",
          order: 0, content: { kind: "text", lines: ["Hola", "Mundo"] },
          style: DEFAULT_PRESET_STYLE,
        },
      },
      "s1",
      7,
    );
    expect(result).toEqual({
      sessionId: "s1",
      sequence: 7,
      mode: "content",
      backgroundTransition: "cut",
      slide: {
        id: "song:1:slide:0",
        content: { kind: "text", lines: ["Hola", "Mundo"] },
        secondaryText: undefined,
        style: DEFAULT_PRESET_STYLE,
        background: { type: "solid", color: DEFAULT_PRESET_STYLE.background.color },
        playback: undefined,
      },
    });
  });

  it("slide null cuando no hay Program", () => {
    expect(toOutputSnapshot({ mode: "clear", slide: null }, "s1", 0).slide).toBeNull();
  });

  it("una slide de video viaja como referencia y adjunta el playback", () => {
    const playback = createInitialPlayback(1000);
    const result = toOutputSnapshot(
      {
        mode: "content",
        slide: {
          id: "media:m1:media:0",
          itemId: "media:m1",
          order: 0,
          content: { kind: "video", mediaId: "m1" },
          style: DEFAULT_PRESET_STYLE,
        },
      },
      "s1",
      1,
      playback,
    );
    expect(result.slide?.content).toEqual({ kind: "video", mediaId: "m1" });
    expect(result.slide?.playback).toEqual(playback);
  });

  it("el playback se ignora en slides que no son de video", () => {
    const playback = createInitialPlayback(1000);
    const result = toOutputSnapshot(
      {
        mode: "content",
        slide: {
          id: "song:1:slide:0",
          itemId: "song:1",
          order: 0,
          content: { kind: "text", lines: ["Hola"] },
          style: DEFAULT_PRESET_STYLE,
        },
      },
      "s1",
      1,
      playback,
    );
    expect(result.slide?.playback).toBeUndefined();
  });
});

describe("snapshotsEqual", () => {
  it("mismo id y mismas líneas → iguales", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ sequence: 9 }))).toBe(true);
  });

  it("mismo slide.id con líneas distintas → distintos (editar Song + recargar)", () => {
    const a = snapshot();
    const b = snapshot({ slide: textSlide(["Letra nueva"]) });
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("mismo id y mismas líneas con estilo distinto → distintos (editar Preset + recargar)", () => {
    const a = snapshot();
    const b = snapshot({
      slide: textSlide(["Línea uno", "Línea dos"], { ...DEFAULT_PRESET_STYLE, fontSize: 12 }),
    });
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("revisión de reproducción distinta → distintos", () => {
    const slide = textSlide(["Línea"]);
    const a = snapshot({
      slide: { ...slide, playback: createInitialPlayback(1000) },
    });
    const b = snapshot({
      slide: { ...slide, playback: { ...createInitialPlayback(1000), revision: 2 } },
    });
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("modo distinto → distintos", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ mode: "black" }))).toBe(false);
  });

  it("slide null vs slide → distintos", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ slide: null }))).toBe(false);
  });

  it("background o modo de transicion distintos son cambios visibles", () => {
    const mediaSlide: OutputSlide = {
      ...textSlide(["Linea"]),
      background: {
        type: "media",
        mediaId: "m1",
        kind: "image",
        fallbackColor: "#123456",
      },
    };
    expect(snapshotsEqual(snapshot(), snapshot({ slide: mediaSlide }))).toBe(false);
    expect(snapshotsEqual(snapshot(), snapshot({ backgroundTransition: "fade" }))).toBe(false);
  });
});

describe("parseOutputMessage", () => {
  it("acepta hello, snapshot, update y bye válidos", () => {
    expect(parseOutputMessage({ type: "hello" })).toEqual({ type: "hello" });
    expect(parseOutputMessage({ type: "snapshot", snapshot: snapshot() })).toEqual({
      type: "snapshot",
      snapshot: snapshot(),
    });
    expect(parseOutputMessage({ type: "update", snapshot: snapshot() })).toEqual({
      type: "update",
      snapshot: snapshot(),
    });
    expect(parseOutputMessage({ type: "bye", sessionId: "s1" })).toEqual({
      type: "bye",
      sessionId: "s1",
    });
  });

  it("tolera la forma heredada con `lines` (ventanas Output viejas)", () => {
    const legacy = {
      sessionId: "s1",
      sequence: 3,
      mode: "content",
      slide: { id: "a", lines: ["una", "dos"], style: DEFAULT_PRESET_STYLE },
    };
    const parsed = parseOutputMessage({ type: "snapshot", snapshot: legacy });
    expect(parsed?.type).toBe("snapshot");
    if (parsed?.type === "snapshot") {
      expect(parsed.snapshot.slide?.content).toEqual({ kind: "text", lines: ["una", "dos"] });
      expect(parsed.snapshot.backgroundTransition).toBe("cut");
      expect(parsed.snapshot.slide?.background).toEqual({
        type: "solid",
        color: DEFAULT_PRESET_STYLE.background.color,
      });
    }
  });

  it("rechaza mensajes inválidos sin lanzar", () => {
    expect(parseOutputMessage(null)).toBeNull();
    expect(parseOutputMessage("hello")).toBeNull();
    expect(parseOutputMessage({ type: "nope" })).toBeNull();
    expect(parseOutputMessage({ type: "snapshot", snapshot: null })).toBeNull();
    expect(
      parseOutputMessage({ type: "snapshot", snapshot: snapshot({ sequence: 1.5 }) }),
    ).toBeNull();
    expect(
      parseOutputMessage({ type: "snapshot", snapshot: snapshot({ mode: "x" as never }) }),
    ).toBeNull();
    expect(
      parseOutputMessage({
        type: "update",
        snapshot: snapshot({
          slide: { id: "a", lines: ["ok", 3] as never, style: DEFAULT_PRESET_STYLE } as never,
        }),
      }),
    ).toBeNull();
    expect(parseOutputMessage({ type: "bye", sessionId: "" })).toBeNull();
  });
});
