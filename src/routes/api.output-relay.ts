import { createFileRoute } from "@tanstack/react-router";

import { parseOutputMessage } from "@/domain/output/output-snapshot";
import { outputRelayHub } from "@/services/output-sync/output-relay-hub.server";
import {
  isLoopbackHostname,
  OUTPUT_RELAY_MAX_BYTES,
  type RelayEnvelope,
} from "@/services/output-sync/relay-output-transport";

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const KEEPALIVE_MS = 15_000;
const encoder = new TextEncoder();

function localRequest(request: Request): boolean {
  return isLoopbackHostname(new URL(request.url).hostname);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}

function validClientId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_ID_PATTERN.test(value);
}

export const Route = createFileRoute("/api/output-relay")({
  server: {
    handlers: {
      GET: ({ request }) => handleOutputRelayGet(request),
      POST: ({ request }) => handleOutputRelayPost(request),
    },
  },
});

export function handleOutputRelayGet(request: Request): Response {
  if (!localRequest(request)) return new Response("Not found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!validClientId(clientId)) return new Response("Invalid client", { status: 400 });

  let disconnect: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = () => {
        if (finished) return;
        finished = true;
        disconnect?.();
        disconnect = null;
        if (keepalive) clearInterval(keepalive);
        keepalive = null;
        try {
          controller.close();
        } catch {
          // El consumidor puede haber cerrado primero.
        }
      };

      disconnect = outputRelayHub.connect(clientId, (message) => {
        if (finished) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      });
      keepalive = setInterval(() => {
        if (!finished) controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, KEEPALIVE_MS);
      request.signal.addEventListener("abort", finish, { once: true });
    },
    cancel() {
      finished = true;
      disconnect?.();
      disconnect = null;
      if (keepalive) clearInterval(keepalive);
      keepalive = null;
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}

export async function handleOutputRelayPost(request: Request): Promise<Response> {
  if (!localRequest(request)) return new Response("Not found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > OUTPUT_RELAY_MAX_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const body = await request.text();
  if (encoder.encode(body).byteLength > OUTPUT_RELAY_MAX_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let envelope: RelayEnvelope;
  try {
    envelope = JSON.parse(body) as RelayEnvelope;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!validClientId(envelope.clientId)) {
    return new Response("Invalid client", { status: 400 });
  }
  const message = parseOutputMessage(envelope.message);
  if (!message) return new Response("Invalid message", { status: 400 });

  outputRelayHub.publish(envelope.clientId, message);
  return new Response(null, { status: 204 });
}
