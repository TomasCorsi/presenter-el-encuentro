import { describe, expect, it } from "bun:test";

import {
  createCompositeOutputTransport,
  type OutputTransport,
} from "@/services/output-sync/output-transport";

function fakeTransport(options: { throwPublish?: boolean; throwClose?: boolean } = {}) {
  const published: unknown[] = [];
  const listeners = new Set<(message: unknown) => void>();
  let closed = false;
  const transport: OutputTransport = {
    publish(message) {
      if (options.throwPublish) throw new Error("offline");
      published.push(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      closed = true;
      if (options.throwClose) throw new Error("offline");
    },
  };
  return {
    transport,
    published,
    emit(message: unknown) {
      for (const listener of listeners) listener(message);
    },
    isClosed: () => closed,
  };
}

describe("createCompositeOutputTransport", () => {
  it("publica en ambos transportes y unifica sus entradas", () => {
    const broadcast = fakeTransport();
    const relay = fakeTransport();
    const composite = createCompositeOutputTransport([broadcast.transport, relay.transport]);
    const received: unknown[] = [];
    composite.subscribe((message) => received.push(message));

    composite.publish({ type: "hello" });
    broadcast.emit("main");
    relay.emit("stream");

    expect(broadcast.published).toEqual([{ type: "hello" }]);
    expect(relay.published).toEqual([{ type: "hello" }]);
    expect(received).toEqual(["main", "stream"]);
  });

  it("un fallo del relay no interrumpe BroadcastChannel ni el cierre", () => {
    const broadcast = fakeTransport();
    const relay = fakeTransport({ throwPublish: true, throwClose: true });
    const composite = createCompositeOutputTransport([relay.transport, broadcast.transport]);

    expect(() => composite.publish({ type: "hello" })).not.toThrow();
    expect(broadcast.published).toEqual([{ type: "hello" }]);
    expect(() => composite.close()).not.toThrow();
    expect(broadcast.isClosed()).toBe(true);
  });
});
