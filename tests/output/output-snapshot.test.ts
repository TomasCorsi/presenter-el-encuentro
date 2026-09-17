import { describe, expect, it } from "bun:test";

import {
  parseOutputMessage,
  snapshotsEqual,
  toOutputSnapshot,
  type OutputSnapshot,
} from "@/domain/output/output-snapshot";
import { DEFAULT_PRESET_STYLE } from "@/domain/presets/preset";

function snapshot(overrides: Partial<OutputSnapshot> = {}): OutputSnapshot {
  return {
    sessionId: "session-a",
    sequence: 0,
    mode: "content",
    slide: { id: "song:1:slide:0", lines: ["Línea uno", "Línea dos"], style: DEFAULT_PRESET_STYLE },
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
      slide: { id: "song:1:slide:0", lines: ["Hola", "Mundo"], style: DEFAULT_PRESET_STYLE },
    });
  });

  it("slide null cuando no hay Program", () => {
    expect(toOutputSnapshot({ mode: "clear", slide: null }, "s1", 0).slide).toBeNull();
  });
});

describe("snapshotsEqual", () => {
  it("mismo id y mismas líneas → iguales", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ sequence: 9 }))).toBe(true);
  });

  it("mismo slide.id con líneas distintas → distintos (editar Song + recargar)", () => {
    const a = snapshot();
    const b = snapshot({
      slide: { id: "song:1:slide:0", lines: ["Letra nueva"], style: DEFAULT_PRESET_STYLE },
    });
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("mismo id y mismas líneas con estilo distinto → distintos (editar Preset + recargar)", () => {
    const a = snapshot();
    const b = snapshot({
      slide: {
        id: "song:1:slide:0",
        lines: ["Línea uno", "Línea dos"],
        style: { ...DEFAULT_PRESET_STYLE, fontSize: 12 },
      },
    });
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("modo distinto → distintos", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ mode: "black" }))).toBe(false);
  });

  it("slide null vs slide → distintos", () => {
    expect(snapshotsEqual(snapshot(), snapshot({ slide: null }))).toBe(false);
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
          slide: { id: "a", lines: ["ok", 3] as never, style: DEFAULT_PRESET_STYLE },
        }),
      }),
    ).toBeNull();
    expect(parseOutputMessage({ type: "bye", sessionId: "" })).toBeNull();
  });
});
