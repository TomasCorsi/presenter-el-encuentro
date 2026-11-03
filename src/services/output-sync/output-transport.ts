import { OUTPUT_CHANNEL_NAME } from "@/domain/output/output-snapshot";

/**
 * Transporte del protocolo Output Sync. Interfaz mínima para que el
 * publisher y el subscriber sean testeables sin BroadcastChannel real.
 *
 * La implementación de BroadcastChannel solo se crea en el navegador
 * (los hooks la instancian dentro de `useEffect`).
 */
export interface OutputTransport {
  publish(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
  close(): void;
}

/**
 * Replica cada publicacion en varios transportes y unifica sus entradas.
 * Un transporte secundario defectuoso nunca debe impedir que BroadcastChannel
 * siga atendiendo Main y Stage.
 */
export function createCompositeOutputTransport(
  transports: readonly OutputTransport[],
): OutputTransport {
  return {
    publish(message) {
      for (const transport of transports) {
        try {
          transport.publish(message);
        } catch {
          // Cada transporte mantiene su propio estado de conexion.
        }
      }
    },
    subscribe(listener) {
      const unsubscribes = transports.map((transport) => transport.subscribe(listener));
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
      };
    },
    close() {
      for (const transport of transports) {
        try {
          transport.close();
        } catch {
          // El resto de los transportes igualmente debe cerrarse.
        }
      }
    },
  };
}

/** Transporte real: BroadcastChannel del navegador. */
export function createBroadcastTransport(): OutputTransport {
  const channel = new BroadcastChannel(OUTPUT_CHANNEL_NAME);
  const listeners = new Set<(message: unknown) => void>();

  channel.onmessage = (event: MessageEvent) => {
    for (const listener of listeners) listener(event.data);
  };

  return {
    publish: (message) => channel.postMessage(message),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => channel.close(),
  };
}

/**
 * Transporte en memoria para tests. Cada instancia creada sobre el mismo
 * `MemoryBus` recibe los mensajes de las demás (como BroadcastChannel, el
 * emisor no recibe su propio mensaje).
 */
export interface MemoryBus {
  transports: Set<MemoryTransport>;
}

interface MemoryTransport extends OutputTransport {
  bus: MemoryBus;
}

export function createMemoryBus(): MemoryBus {
  return { transports: new Set() };
}

export function createMemoryTransport(bus: MemoryBus): OutputTransport {
  const listeners = new Set<(message: unknown) => void>();
  const transport: MemoryTransport = {
    bus,
    publish(message) {
      for (const other of bus.transports) {
        if (other === transport) continue;
        for (const listener of otherListeners(other)) listener(message);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      bus.transports.delete(transport);
    },
  };
  bus.transports.add(transport);
  memoryListeners.set(transport, listeners);
  return transport;
}

// Los listeners viven en un WeakMap para no exponerlos en la interfaz pública.
const memoryListeners = new WeakMap<MemoryTransport, Set<(message: unknown) => void>>();

function otherListeners(transport: MemoryTransport): Set<(message: unknown) => void> {
  return memoryListeners.get(transport) ?? new Set();
}
