import { describe, expect, it } from "bun:test";

import {
  createRelayOutputTransport,
  isLoopbackHostname,
} from "@/services/output-sync/relay-output-transport";

class FakeEventSource {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
}

describe("relay output transport", () => {
  it("publica envelopes, recibe SSE y expone conexion", async () => {
    const source = new FakeEventSource();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const transport = createRelayOutputTransport({
      clientId: "stream-a",
      eventSourceFactory: (url) => {
        expect(url).toBe("/api/output-relay?clientId=stream-a");
        return source;
      },
      fetchFn: (async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(url), init });
        return new Response(null, { status: 204 });
      }) as typeof fetch,
    });
    const messages: unknown[] = [];
    const statuses: string[] = [];
    transport.subscribe((message) => messages.push(message));
    transport.subscribeStatus((status) => statuses.push(status));

    source.onopen?.(new Event("open"));
    transport.publish({ type: "hello" });
    await Promise.resolve();
    source.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify({ type: "bye", sessionId: "s1" }) }),
    );
    source.onmessage?.(new MessageEvent("message", { data: "not-json" }));

    expect(statuses).toEqual(["connected"]);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      clientId: "stream-a",
      message: { type: "hello" },
    });
    expect(messages).toEqual([{ type: "bye", sessionId: "s1" }]);
    transport.close();
    expect(source.closed).toBe(true);
  });

  it("reconoce exclusivamente hosts loopback", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });
});
