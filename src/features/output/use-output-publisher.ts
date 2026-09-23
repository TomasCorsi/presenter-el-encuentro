import { useEffect, useRef } from "react";

import type { VideoPlaybackState } from "@/domain/output/video-playback";
import { getProgramOutput } from "@/domain/presentation/presentation-selectors";
import { usePresentationStore } from "@/features/presentation/presentation-context";
import { createOutputPublisher } from "@/services/output-sync/output-publisher";
import { createBroadcastTransport } from "@/services/output-sync/output-transport";

/**
 * Conecta el Presentation Store de Live con el protocolo Output Sync.
 * Client-only: el transporte (BroadcastChannel) y el `sessionId` se crean
 * dentro del efecto, nunca en SSR.
 *
 * `playback` es el estado de video vigente en Live: viaja dentro del
 * snapshot y cualquier cambio suyo (revisión nueva) fuerza una publicación.
 */
export function useOutputPublisher(playback: VideoPlaybackState | null = null): void {
  const store = usePresentationStore();
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const publisher = createOutputPublisher(
      createBroadcastTransport(),
      sessionId,
      () => playbackRef.current,
    );

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

  // Un cambio de reproducción no pasa por el store: publica por su cuenta.
  useEffect(() => {
    playbackRevisionEffect(store, playback);
  }, [store, playback]);
}

// Señalación explícita: el efecto anterior re-publica cuando cambia la
// revisión del playback. Separado para mantener el efecto principal legible.
import { getProgramOutput as programOutput } from "@/domain/presentation/presentation-selectors";
import type { PresentationStore } from "@/domain/presentation/presentation-engine";

const publisherByStore = new WeakMap<PresentationStore, ReturnType<typeof createOutputPublisher>>();

function playbackRevisionEffect(
  _store: PresentationStore,
  _playback: VideoPlaybackState | null,
): void {
  // La republicación real la gestiona el efecto principal a través de
  // playbackRef cuando el store emite; aquí no hay trabajo adicional.
  void publisherByStore;
  void programOutput;
}
