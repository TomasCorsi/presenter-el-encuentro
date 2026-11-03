import { describe, expect, it } from "bun:test";

import { handleOutputRelayGet, handleOutputRelayPost } from "@/routes/api.output-relay";
import { OUTPUT_RELAY_MAX_BYTES } from "@/services/output-sync/relay-output-transport";

function request(
  url: string,
  body: string,
  headers: Record<string, string> = {},
): Request {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    url,
    headers: { get: (name: string) => normalized.get(name.toLowerCase()) ?? null },
    text: async () => body,
    signal: new AbortController().signal,
  } as unknown as Request;
}

function post(body: string, headers: Record<string, string> = {}) {
  return handleOutputRelayPost(
    request("http://127.0.0.1:8080/api/output-relay", body, {
      origin: "http://127.0.0.1:8080",
      ...headers,
    }),
  );
}

describe("output relay route", () => {
  it("acepta sólo loopback, mismo origin y mensajes válidos", async () => {
    const remote = await handleOutputRelayPost(
      request("https://example.com/api/output-relay", "{}"),
    );
    expect(remote.status).toBe(404);

    const crossOrigin = await handleOutputRelayPost(
      request("http://127.0.0.1:8080/api/output-relay", "{}", {
        origin: "https://evil.example",
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect((await post("not-json")).status).toBe(400);
    expect(
      (await post(JSON.stringify({ clientId: "client-a", message: { type: "wat" } }))).status,
    ).toBe(400);
    expect(
      (await post(JSON.stringify({ clientId: "client-a", message: { type: "hello" } }))).status,
    ).toBe(204);
  });

  it("rechaza payloads mayores a 256 KiB", async () => {
    const response = await post("{}", {
      "content-length": String(OUTPUT_RELAY_MAX_BYTES + 1),
    });
    expect(response.status).toBe(413);
  });

  it("entrega SSE a otros clientes y limpia al cancelar", async () => {
    const controller = new AbortController();
    const response = handleOutputRelayGet(
      new Request("http://127.0.0.1:8080/api/output-relay?clientId=stream-client", {
        headers: { origin: "http://127.0.0.1:8080" },
        signal: controller.signal,
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();

    const sent = await post(
      JSON.stringify({ clientId: "live-client", message: { type: "hello" } }),
    );
    expect(sent.status).toBe(204);
    const chunk = await reader.read();
    expect(new TextDecoder().decode(chunk.value)).toContain('data: {"type":"hello"}');

    controller.abort();
    await reader.cancel();
  });
});
