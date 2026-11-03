import { useEffect, useRef, useState } from "react";

import type { VideoPlaybackState } from "@/domain/output/video-playback";
import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import { buildStageProjection } from "@/domain/output/stage-projection";
import { getProgramOutput } from "@/domain/presentation/presentation-selectors";
import { usePresentationStore } from "@/features/presentation/presentation-context";
import { createOutputPublisher, type OutputPublisher } from "@/services/output-sync/output-publisher";
import {
  createRelayOutputTransport,
  isLoopbackHostname,
  type StreamRelayStatus,
} from "@/services/output-sync/relay-output-transport";
import {
  createBroadcastTransport,
  createCompositeOutputTransport,
} from "@/services/output-sync/output-transport";

/**
 * Conecta el Presentation Store de Live con el protocolo Output Sync.
 * Client-only: el transporte (BroadcastChannel) y el `sessionId` se crean
 * dentro del efecto, nunca en SSR.
 *
 * `playback` es el estado de video vigente en Live: viaja dentro del
 * snapshot y cualquier cambio suyo (revisión nueva) fuerza una publicación,
 * aunque no pase por el store.
 */
export function useOutputPublisher(
  playback: VideoPlaybackState | null = null,
  backgroundTransition: BackgroundTransition = "cut",
): StreamRelayStatus {
  const store = usePresentationStore();
  const [relayStatus, setRelayStatus] = useState<StreamRelayStatus>("connecting");
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const transitionRef = useRef(backgroundTransition);
  transitionRef.current = backgroundTransition;
  const publisherRef = useRef<OutputPublisher | null>(null);

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const broadcastTransport = createBroadcastTransport();
    const relay = isLoopbackHostname(window.location.hostname)
      ? createRelayOutputTransport()
      : null;
    setRelayStatus(relay ? relay.getStatus() : "unsupported");
    const unsubscribeRelayStatus = relay?.subscribeStatus(setRelayStatus) ?? null;
    const publisher = createOutputPublisher(
      relay
        ? createCompositeOutputTransport([broadcastTransport, relay])
        : broadcastTransport,
      sessionId,
      () => playbackRef.current,
      () => transitionRef.current,
    );
    publisherRef.current = publisher;

    // Estado inicial: cualquier Output que abra ahora recibe el Program actual.
    const initialState = store.getState();
    publisher.sync(getProgramOutput(initialState), buildStageProjection(initialState));

    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      publisher.sync(getProgramOutput(state), buildStageProjection(state));
    });

    return () => {
      publisherRef.current = null;
      unsubscribe();
      unsubscribeRelayStatus?.();
      publisher.close();
    };
  }, [store]);

  // Un cambio de reproducción no pasa por el store: publica por su cuenta.
  useEffect(() => {
    const state = store.getState();
    publisherRef.current?.sync(getProgramOutput(state), buildStageProjection(state));
  }, [store, playback, backgroundTransition]);

  return relayStatus;
}
