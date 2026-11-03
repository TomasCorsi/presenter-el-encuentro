import { describe, expect, it } from "bun:test";

import { createOutputRelayHub } from "@/services/output-sync/output-relay-hub.server";

describe("output relay hub", () => {
  it("retransmite a los otros clientes, excluye al emisor y limpia conexiones", () => {
    const hub = createOutputRelayHub();
    const a: unknown[] = [];
    const b: unknown[] = [];
    const disconnectA = hub.connect("a", (message) => a.push(message));
    hub.connect("b", (message) => b.push(message));

    expect(hub.publish("a", { type: "hello" })).toBe(1);
    expect(a).toEqual([]);
    expect(b).toEqual([{ type: "hello" }]);
    expect(hub.size()).toBe(2);

    disconnectA();
    expect(hub.size()).toBe(1);
  });
});
