import {
  HEARTBEAT_INTERVAL_MS,
  LIVENESS_TIMEOUT_MS,
  parseOutputMessage,
  type OutputMessage,
  type OutputSnapshot,
} from "@/domain/output/output-snapshot";
import type { OutputTransport } from "@/services/output-sync/output-transport";

/**
 * Lado Output del protocolo Output Sync (ADR-028, ADR-029).
 *
 * Política de sesión: el primer snapshot válido vincula al Output a ese
 * `sessionId`; mientras la sesión siga viva se ignoran otras sesiones. La
 * sesión termina por `bye` o por timeout de heartbeat, y solo entonces Output
 * queda libre para adoptar otra.
 *
 * Liveness: `hello` cada HEARTBEAT_INTERVAL_MS; si no llega ninguna señal
 * válida de la sesión vinculada en LIVENESS_TIMEOUT_MS, la salida pasa a
 * vacío seguro. `bye` acelera la transición pero no es la garantía.
 */
export type OutputConnection = "connecting" | "connected" | "disconnected";

export interface OutputSubscriberState {
  connection: OutputConnection;
  /** `null` cuando no hay sesión válida: la salida debe ser negro puro. */
  snapshot: OutputSnapshot | null;
}

export interface OutputSubscriber {
  getState(): OutputSubscriberState;
  subscribe(listener: () => void): () => void;
  close(): void;
}

export interface OutputSubscriberOptions {
  heartbeatIntervalMs?: number;
  livenessTimeoutMs?: number;
  /** Inyectable en tests; por defecto `Date.now`. */
  now?: () => number;
  /** Inyectable en tests; por defecto `setInterval`/`clearInterval`. */
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export function createOutputSubscriber(
  transport: OutputTransport,
  options: OutputSubscriberOptions = {},
): OutputSubscriber {
  const heartbeatMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const timeoutMs = options.livenessTimeoutMs ?? LIVENESS_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const setIv = options.setIntervalFn ?? setInterval;
  const clearIv = options.clearIntervalFn ?? clearInterval;

  let state: OutputSubscriberState = { connection: "connecting", snapshot: null };
  let boundSessionId: string | null = null;
  let lastSequence = -1;
  let lastSignalAt = now();
  const listeners = new Set<() => void>();

  function emit(next: OutputSubscriberState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  function adoptSnapshot(snapshot: OutputSnapshot): void {
    boundSessionId = snapshot.sessionId;
    lastSequence = snapshot.sequence;
    lastSignalAt = now();
    emit({ connection: "connected", snapshot });
  }

  function disconnect(): void {
    if (state.connection === "disconnected") return;
    boundSessionId = null;
    lastSequence = -1;
    emit({ connection: "disconnected", snapshot: null });
  }

  function handleMessage(raw: unknown): void {
    const message = parseOutputMessage(raw);
    if (!message) return; // mensajes inválidos: ignorar en silencio

    if (message.type === "bye") {
      if (message.sessionId === boundSessionId) disconnect();
      return;
    }

    if (message.type !== "snapshot" && message.type !== "update") return;
    const { snapshot } = message;

    // Política de sesión: solo se acepta la sesión vinculada; si no hay
    // ninguna (inicio o tras desconexión), se adopta la primera válida.
    if (boundSessionId !== null && snapshot.sessionId !== boundSessionId) return;

    // Orden: se descarta lo viejo o repetido dentro de la misma sesión.
    if (snapshot.sessionId === boundSessionId && snapshot.sequence <= lastSequence) {
      // Aunque se descarte, cuenta como señal de vida de la sesión.
      lastSignalAt = now();
      return;
    }

    adoptSnapshot(snapshot);
  }

  const unsubscribeTransport = transport.subscribe(handleMessage);

  function sendHello(): void {
    const message: OutputMessage = { type: "hello" };
    transport.publish(message);
  }

  // Primer `hello` inmediato y luego heartbeat periódico. El mismo timer
  // vigila el liveness: sin señal válida de la sesión en `timeoutMs`, corta.
  sendHello();
  const timer = setIv(() => {
    if (boundSessionId !== null && now() - lastSignalAt > timeoutMs) disconnect();
    sendHello();
  }, heartbeatMs);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      clearIv(timer);
      unsubscribeTransport();
      transport.close();
    },
  };
}
