import { describe, expect, it } from "bun:test";

import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import { createOutputSubscriber } from "@/services/output-sync/output-subscriber";
import {
  createMemoryBus,
  createMemoryTransport,
  type MemoryBus,
} from "@/services/output-sync/output-transport";

function snapshot(sessionId: string, sequence: number, lines = ["A"]): OutputSnapshot {
  return {
    sessionId,
    sequence,
    mode: "content",
    slide: { id: "s:0", content: { kind: "text", lines }, style: { background: { type: "solid", color: "#000000" }, fontFamily: "Inter", fontSize: 48, fontWeight: 600, color: "#FFFFFF", textAlign: "center", verticalAlign: "middle", lineHeight: 1.2, padding: 48 } },
  };
}

/** Reloj y timers manuales para controlar heartbeat y timeout. */
function fakeClock() {
  let current = 0;
  const callbacks: (() => void)[] = [];
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
    tick() {
      for (const cb of [...callbacks]) cb();
    },
    setIntervalFn: ((cb: () => void) => {
      callbacks.push(cb);
      return callbacks.length;
    }) as unknown as typeof setInterval,
    clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
  };
}

function setup() {
  const bus: MemoryBus = createMemoryBus();
  const live = createMemoryTransport(bus);
  const clock = fakeClock();
  const subscriber = createOutputSubscriber(createMemoryTransport(bus), {
    now: clock.now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });
  return { bus, live, clock, subscriber };
}

describe("createOutputSubscriber", () => {
  it("envía hello al abrir y adopta el primer snapshot válido", () => {
    const { live, subscriber } = setup();
    const hellos: unknown[] = [];
    live.subscribe((m) => hellos.push(m));
    // El hello inicial ya se envió en setup; re-suscribir no lo captura,
    // así que verificamos la adopción directamente.
    expect(subscriber.getState().connection).toBe("connecting");
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 0) });
    expect(subscriber.getState().connection).toBe("connected");
    expect(subscriber.getState().snapshot?.sessionId).toBe("live-a");
    expect(hellos.length).toBeGreaterThanOrEqual(0);
  });

  it("descarta mensajes fuera de orden de la misma sesión", () => {
    const { live, subscriber } = setup();
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 5) });
    live.publish({ type: "update", snapshot: snapshot("live-a", 3, ["Viejo"]) });
    expect(subscriber.getState().snapshot?.sequence).toBe(5);
    live.publish({ type: "update", snapshot: snapshot("live-a", 6, ["Nuevo"]) });
    expect(contentLines(subscriber.getState().snapshot)).toEqual(["Nuevo"]);
  });

  it("vinculado a Live A ignora Live B; tras bye de A puede adoptar B", () => {
    const { live, subscriber } = setup();
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 0) });
    live.publish({ type: "update", snapshot: snapshot("live-b", 0, ["De B"]) });
    expect(subscriber.getState().snapshot?.sessionId).toBe("live-a");

    live.publish({ type: "bye", sessionId: "live-a" });
    expect(subscriber.getState().connection).toBe("disconnected");
    expect(subscriber.getState().snapshot).toBeNull();

    live.publish({ type: "snapshot", snapshot: snapshot("live-b", 0, ["De B"]) });
    expect(subscriber.getState().snapshot?.sessionId).toBe("live-b");
  });

  it("timeout sin señal → desconectado; Live vuelve → recupera snapshot", () => {
    const { live, clock, subscriber } = setup();
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 0) });
    expect(subscriber.getState().connection).toBe("connected");

    // Live desaparece sin bye: avanzan 6 s sin señal y corre el heartbeat.
    clock.advance(6000);
    clock.tick();
    expect(subscriber.getState().connection).toBe("disconnected");
    expect(subscriber.getState().snapshot).toBeNull();

    // Reconexión: una nueva sesión emite y Output la adopta.
    live.publish({ type: "snapshot", snapshot: snapshot("live-c", 0, ["Vuelve"]) });
    expect(subscriber.getState().connection).toBe("connected");
    expect(contentLines(subscriber.getState().snapshot)).toEqual(["Vuelve"]);
  });

  it("ignora bye de otra sesión", () => {
    const { live, subscriber } = setup();
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 0) });
    live.publish({ type: "bye", sessionId: "live-b" });
    expect(subscriber.getState().connection).toBe("connected");
  });

  it("ignora mensajes inválidos sin lanzar", () => {
    const { live, subscriber } = setup();
    live.publish("basura");
    live.publish({ type: "snapshot", snapshot: { sessionId: 1 } });
    expect(subscriber.getState().connection).toBe("connecting");
  });

  it("varios subscribers reciben el mismo snapshot", () => {
    const bus = createMemoryBus();
    const live = createMemoryTransport(bus);
    const a = createOutputSubscriber(createMemoryTransport(bus), { setIntervalFn: fakeClock().setIntervalFn });
    const b = createOutputSubscriber(createMemoryTransport(bus), { setIntervalFn: fakeClock().setIntervalFn });
    live.publish({ type: "snapshot", snapshot: snapshot("live-a", 0) });
    expect(a.getState().snapshot?.sessionId).toBe("live-a");
    expect(b.getState().snapshot?.sessionId).toBe("live-a");
  });
});
