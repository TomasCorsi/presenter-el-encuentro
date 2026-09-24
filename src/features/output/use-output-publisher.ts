import { useEffect, useRef } from "react";

import type { VideoPlaybackState } from "@/domain/output/video-playback";
import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import { getProgramOutput } from "@/domain/presentation/presentation-selectors";
import { usePresentationStore } from "@/features/presentation/presentation-context";
import { createOutputPublisher, type OutputPublisher } from "@/services/output-sync/output-publisher";
import { createBroadcastTransport } from "@/services/output-sync/output-transport";

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
): void {
  const store = usePresentationStore();
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const transitionRef = useRef(backgroundTransition);
  transitionRef.current = backgroundTransition;
  const publisherRef = useRef<OutputPublisher | null>(null);

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const publisher = createOutputPublisher(
      createBroadcastTransport(),
      sessionId,
      () => playbackRef.current,
      () => transitionRef.current,
    );
    publisherRef.current = publisher;

    // Estado inicial: cualquier Output que abra ahora recibe el Program actual.
    publisher.sync(getProgramOutput(store.getState()));

    const unsubscribe = store.subscribe(() => {
      publisher.sync(getProgramOutput(store.getState()));
    });

    return () => {
      publisherRef.current = null;
      unsubscribe();
      publisher.close();
    };
  }, [store]);

  // Un cambio de reproducción no pasa por el store: publica por su cuenta.
  useEffect(() => {
    publisherRef.current?.sync(getProgramOutput(store.getState()));
  }, [store, playback, backgroundTransition]);
}
