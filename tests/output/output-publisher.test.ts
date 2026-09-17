import { describe, expect, it } from "bun:test";

import type { ProgramOutput } from "@/domain/presentation/presentation-selectors";
import { createOutputPublisher } from "@/services/output-sync/output-publisher";
import {
  createMemoryBus,
  createMemoryTransport,
} from "@/services/output-sync/output-transport";

function output(lines: string[], id = "song:1:slide:0"): ProgramOutput {
  return {
    mode: "content",
    slide: { id, itemId: "song:1", order: 0, content: { kind: "text", lines } },
  };
}

describe("createOutputPublisher", () => {
  it("publica update solo cuando cambia lo que Output pinta", () => {
    const bus = createMemoryBus();
    const publisherTransport = createMemoryTransport(bus);
    const listenerTransport = createMemoryTransport(bus);
    const received: unknown[] = [];
    listenerTransport.subscribe((message) => received.push(message));

    const publisher = createOutputPublisher(publisherTransport, "s1");
    publisher.sync(output(["A"]));
    publisher.sync(output(["A"])); // sin cambios → no publica
    publisher.sync(output(["B"])); // mismo id, líneas nuevas → publica

    const updates = received.filter(
      (m) => (m as { type?: string }).type === "update",
    ) as { snapshot: { sequence: number; slide: { lines: string[] } } }[];
    expect(updates).toHaveLength(2);
    expect(updates[0]!.snapshot.sequence).toBe(0);
    expect(updates[1]!.snapshot.sequence).toBe(1);
    expect(updates[1]!.snapshot.slide.lines).toEqual(["B"]);
  });

  it("responde hello con un snapshot completo", () => {
    const bus = createMemoryBus();
    const publisher = createOutputPublisher(createMemoryTransport(bus), "s1");
    publisher.sync(output(["A"]));

    const listenerTransport = createMemoryTransport(bus);
    const received: unknown[] = [];
    listenerTransport.subscribe((message) => received.push(message));
    listenerTransport.publish({ type: "hello" });

    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe("snapshot");
  });

  it("emite bye con su sessionId al cerrar", () => {
    const bus = createMemoryBus();
    const publisherTransport = createMemoryTransport(bus);
    const listenerTransport = createMemoryTransport(bus);
    const received: unknown[] = [];
    listenerTransport.subscribe((message) => received.push(message));

    const publisher = createOutputPublisher(publisherTransport, "s1");
    publisher.close();

    expect(received).toEqual([{ type: "bye", sessionId: "s1" }]);
  });
});
