import type { OutputTransport } from "./output-transport";
import { createUuid } from "@/utils/create-id";

export const OUTPUT_RELAY_PATH = "/api/output-relay";
export const OUTPUT_RELAY_MAX_BYTES = 256 * 1024;

export type StreamRelayStatus = "unsupported" | "connecting" | "connected" | "disconnected";

export interface RelayEnvelope {
  clientId: string;
  message: unknown;
}

export interface RelayOutputTransport extends OutputTransport {
  getStatus(): StreamRelayStatus;
  subscribeStatus(listener: (status: StreamRelayStatus) => void): () => void;
}

interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface CreateRelayOutputTransportOptions {
  path?: string;
  clientId?: string;
  eventSourceFactory?: (url: string) => EventSourceLike;
  fetchFn?: typeof fetch;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

/** Transporte HTTP/SSE para consumidores CEF que no comparten BroadcastChannel. */
export function createRelayOutputTransport(
  options: CreateRelayOutputTransportOptions = {},
): RelayOutputTransport {
  const path = options.path ?? OUTPUT_RELAY_PATH;
  const clientId = options.clientId ?? createUuid();
  const fetchFn = options.fetchFn ?? fetch;
  const eventSourceFactory = options.eventSourceFactory ?? ((url: string) => new EventSource(url));
  const listeners = new Set<(message: unknown) => void>();
  const statusListeners = new Set<(status: StreamRelayStatus) => void>();
  let status: StreamRelayStatus = "connecting";
  let closed = false;

  const setStatus = (next: StreamRelayStatus) => {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener(next);
  };

  const separator = path.includes("?") ? "&" : "?";
  const source = eventSourceFactory(`${path}${separator}clientId=${encodeURIComponent(clientId)}`);
  source.onopen = () => setStatus("connected");
  source.onerror = () => {
    if (!closed) setStatus("disconnected");
  };
  source.onmessage = (event) => {
    try {
      const message: unknown = JSON.parse(event.data);
      for (const listener of listeners) listener(message);
    } catch {
      // El parser de dominio valida mensajes; JSON roto se ignora antes.
    }
  };

  return {
    publish(message) {
      const body = JSON.stringify({ clientId, message } satisfies RelayEnvelope);
      void fetchFn(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }).then(
        (response) => {
          if (!response.ok) setStatus("disconnected");
        },
        () => setStatus("disconnected"),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    close() {
      closed = true;
      source.close();
      listeners.clear();
      statusListeners.clear();
      status = "disconnected";
    },
  };
}
