import { describe, expect, it } from "bun:test";

import type { ProgramOutput } from "@/domain/presentation/presentation-selectors";
import { createOutputPublisher } from "@/services/output-sync/output-publisher";
import { createOutputSubscriber } from "@/services/output-sync/output-subscriber";
import {
  createCompositeOutputTransport,
  createMemoryBus,
  createMemoryTransport,
} from "@/services/output-sync/output-transport";

function textOutput(lines: string[]): ProgramOutput {
  return {
    mode: "content",
    slide: {
      id: "song:1:slide:0",
      itemId: "song:1",
      order: 0,
      content: { kind: "text", lines },
    },
  };
}

const subscriberTimers = {
  setIntervalFn: (() => 1) as unknown as typeof setInterval,
  clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
};

describe("Stream relay integration", () => {
  it("responde late-open por relay sin dejar de publicar en BroadcastChannel", () => {
    const broadcastBus = createMemoryBus();
    const relayBus = createMemoryBus();
    const publisher = createOutputPublisher(
      createCompositeOutputTransport([
        createMemoryTransport(broadcastBus),
        createMemoryTransport(relayBus),
      ]),
      "live-session",
    );

    publisher.sync(textOutput(["Inicial"]));

    const stream = createOutputSubscriber(
      createMemoryTransport(relayBus),
      subscriberTimers,
    );
    expect(stream.getState().connection).toBe("connected");
    expect(stream.getState().snapshot).toEqual(
      expect.objectContaining({
        sessionId: "live-session",
        slide: expect.objectContaining({
          content: { kind: "text", lines: ["Inicial"] },
        }),
      }),
    );

    const main = createOutputSubscriber(
      createMemoryTransport(broadcastBus),
      subscriberTimers,
    );
    publisher.sync(textOutput(["Actualizado"]));

    expect(main.getState().snapshot?.slide?.content).toEqual({
      kind: "text",
      lines: ["Actualizado"],
    });
    expect(stream.getState().snapshot?.slide?.content).toEqual({
      kind: "text",
      lines: ["Actualizado"],
    });

    publisher.close();
    expect(main.getState()).toEqual({ connection: "disconnected", snapshot: null });
    expect(stream.getState()).toEqual({ connection: "disconnected", snapshot: null });
    main.close();
    stream.close();
  });
});
