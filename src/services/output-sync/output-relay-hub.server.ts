import type { OutputMessage } from "@/domain/output/output-snapshot";

interface RelayClient {
  clientId: string;
  send(message: OutputMessage): void;
}

export interface OutputRelayHub {
  connect(clientId: string, send: RelayClient["send"]): () => void;
  publish(senderId: string, message: OutputMessage): number;
  size(): number;
}

/** Hub efimero: deliberadamente sin persistencia y valido para un solo proceso local. */
export function createOutputRelayHub(): OutputRelayHub {
  const clients = new Set<RelayClient>();

  return {
    connect(clientId, send) {
      const client = { clientId, send };
      clients.add(client);
      return () => clients.delete(client);
    },
    publish(senderId, message) {
      let delivered = 0;
      for (const client of clients) {
        if (client.clientId === senderId) continue;
        client.send(message);
        delivered += 1;
      }
      return delivered;
    },
    size: () => clients.size,
  };
}

export const outputRelayHub = createOutputRelayHub();
