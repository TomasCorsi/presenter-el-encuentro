import { useEffect, useState } from "react";

import { createOutputSubscriber, type OutputSubscriberState } from "@/services/output-sync/output-subscriber";
import { createBroadcastTransport } from "@/services/output-sync/output-transport";

const SSR_STATE: OutputSubscriberState = { connection: "connecting", snapshot: null };

/**
 * Estado de salida para `/output/main`. Client-only: en SSR devuelve el
 * estado inicial (superficie segura) y el subscriber se crea tras montar.
 */
export function useOutputSnapshot(): OutputSubscriberState {
  const [state, setState] = useState<OutputSubscriberState>(SSR_STATE);

  useEffect(() => {
    const subscriber = createOutputSubscriber(createBroadcastTransport());
    setState(subscriber.getState());
    const unsubscribe = subscriber.subscribe(() => setState(subscriber.getState()));
    return () => {
      unsubscribe();
      subscriber.close();
    };
  }, []);

  return state;
}
