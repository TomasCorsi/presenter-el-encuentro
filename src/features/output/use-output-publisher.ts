import { useEffect } from "react";

import { getProgramOutput } from "@/domain/presentation/presentation-selectors";
import { usePresentationStore } from "@/features/presentation/presentation-context";
import { createOutputPublisher } from "@/services/output-sync/output-publisher";
import { createBroadcastTransport } from "@/services/output-sync/output-transport";

/**
 * Conecta el Presentation Store de Live con el protocolo Output Sync.
 * Client-only: el transporte (BroadcastChannel) y el `sessionId` se crean
 * dentro del efecto, nunca en SSR.
 */
export function useOutputPublisher(): void {
  const store = usePresentationStore();

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const publisher = createOutputPublisher(createBroadcastTransport(), sessionId);

    // Estado inicial: cualquier Output que abra ahora recibe el Program actual.
    publisher.sync(getProgramOutput(store.getState()));

    const unsubscribe = store.subscribe(() => {
      publisher.sync(getProgramOutput(store.getState()));
    });

    return () => {
      unsubscribe();
      publisher.close();
    };
  }, [store]);
}
