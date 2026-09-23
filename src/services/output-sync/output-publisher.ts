import type { VideoPlaybackState } from "@/domain/output/video-playback";
import type { ProgramOutput } from "@/domain/presentation/presentation-selectors";
import {
  parseOutputMessage,
  snapshotsEqual,
  toOutputSnapshot,
  type OutputMessage,
  type OutputSnapshot,
} from "@/domain/output/output-snapshot";
import type { OutputTransport } from "@/services/output-sync/output-transport";

/**
 * Lado Live del protocolo Output Sync (ADR-028, ADR-029).
 *
 * Live es la única autoridad: publica el estado completo de Program y
 * responde a los `hello` de los Outputs. Nunca recibe comandos.
 */
export interface OutputPublisher {
  /** Emite el estado actual si cambió respecto a lo último publicado. */
  sync(output: ProgramOutput): void;
  /** Avisa del cierre de la sesión (optimización; la garantía es el heartbeat). */
  close(): void;
}

export function createOutputPublisher(
  transport: OutputTransport,
  sessionId: string,
  /** Estado de reproducción de video vigente en Live (si hay uno al aire). */
  getPlayback: () => VideoPlaybackState | null = () => null,
): OutputPublisher {
  let sequence = 0;
  let lastPublished: OutputSnapshot | null = null;

  function publish(type: "snapshot" | "update", output: ProgramOutput): void {
    const snapshot = toOutputSnapshot(output, sessionId, sequence++, getPlayback());
    lastPublished = snapshot;
    const message: OutputMessage = { type, snapshot };
    transport.publish(message);
  }

  // `currentOutput` se fija en el primer `sync`, que el hook ejecuta antes de
  // que ningún Output pueda emitir `hello` (el canal aún no tenía publisher).
  let currentOutput: ProgramOutput = { mode: "content", slide: null };

  const unsubscribe = transport.subscribe((raw) => {
    const message = parseOutputMessage(raw);
    // Un `hello` siempre se responde con el estado completo: es el heartbeat
    // y el mecanismo de inicialización de ventanas nuevas.
    if (message?.type === "hello") publish("snapshot", currentOutput);
  });

  return {
    sync(output) {
      currentOutput = output;
      const snapshot = toOutputSnapshot(output, sessionId, sequence, getPlayback());
      if (lastPublished && snapshotsEqual(lastPublished, snapshot)) return;
      publish("update", output);
    },
    close() {
      const message: OutputMessage = { type: "bye", sessionId };
      transport.publish(message);
      unsubscribe();
      transport.close();
    },
  };
}
