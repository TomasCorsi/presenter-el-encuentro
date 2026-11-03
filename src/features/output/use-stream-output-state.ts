import { useEffect, useState } from "react";

import type { OutputSubscriberState } from "@/services/output-sync/output-subscriber";
import { createOutputSubscriber } from "@/services/output-sync/output-subscriber";
import {
  createRelayOutputTransport,
  isLoopbackHostname,
} from "@/services/output-sync/relay-output-transport";

const INITIAL_STATE: OutputSubscriberState = { connection: "connecting", snapshot: null };

/** Estado read-only de Stream; stale elimina el overlay en vez de retenerlo. */
export function useStreamOutputState(): OutputSubscriberState {
  const [state, setState] = useState<OutputSubscriberState>(INITIAL_STATE);

  useEffect(() => {
    if (!isLoopbackHostname(window.location.hostname)) {
      setState({ connection: "disconnected", snapshot: null });
      return;
    }

    const subscriber = createOutputSubscriber(createRelayOutputTransport());
    setState(subscriber.getState());
    const unsubscribe = subscriber.subscribe(() => setState(subscriber.getState()));
    return () => {
      unsubscribe();
      subscriber.close();
    };
  }, []);

  return state;
}
