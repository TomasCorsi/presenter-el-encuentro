/**
 * Estado de reproducción de video, AUTORITATIVO y recuperable (Fase 10).
 *
 * Vive en Live (la autoridad) y viaja dentro del OutputSnapshot solo para
 * slides de video. Output nunca decide play/pause por su cuenta: calcula la
 * posición esperada a partir de este estado y corrige la deriva.
 *
 * Dominio puro: el tiempo entra como parámetro (`now`), así que todo es
 * testeable sin relojes reales.
 */
export interface VideoPlaybackState {
  state: "playing" | "paused";
  /** Posición (segundos) en el instante `changedAtEpochMs`. */
  offsetSeconds: number;
  /** `Date.now()` de Live en el último cambio de estado. */
  changedAtEpochMs: number;
  loop: boolean;
  /** Incremental: Output ignora revisiones viejas. */
  revision: number;
}

/** Una slide de video entra al aire reproduciendo desde el inicio. */
export function createInitialPlayback(now: number): VideoPlaybackState {
  return { state: "playing", offsetSeconds: 0, changedAtEpochMs: now, loop: false, revision: 1 };
}

/**
 * Posición esperada en `now`. Con `loop` y duración conocida, envuelve con
 * módulo; sin duración devuelve la posición lineal (Output corrige cuando
 * conozca la duración real del archivo).
 */
export function expectedOffsetSeconds(
  playback: VideoPlaybackState,
  now: number,
  durationSeconds?: number,
): number {
  const raw =
    playback.state === "playing"
      ? playback.offsetSeconds + Math.max(0, (now - playback.changedAtEpochMs) / 1000)
      : playback.offsetSeconds;
  if (playback.loop && durationSeconds && durationSeconds > 0) return raw % durationSeconds;
  return raw;
}

export function pausePlayback(playback: VideoPlaybackState, now: number): VideoPlaybackState {
  if (playback.state === "paused") return playback;
  return {
    ...playback,
    state: "paused",
    offsetSeconds: expectedOffsetSeconds(playback, now),
    changedAtEpochMs: now,
    revision: playback.revision + 1,
  };
}

export function playPlayback(playback: VideoPlaybackState, now: number): VideoPlaybackState {
  if (playback.state === "playing") return playback;
  return {
    ...playback,
    state: "playing",
    changedAtEpochMs: now,
    revision: playback.revision + 1,
  };
}

/** Reiniciar: al inicio y reproduciendo (acción explícita del operador). */
export function restartPlayback(playback: VideoPlaybackState, now: number): VideoPlaybackState {
  return {
    ...playback,
    state: "playing",
    offsetSeconds: 0,
    changedAtEpochMs: now,
    revision: playback.revision + 1,
  };
}

export function togglePlaybackLoop(playback: VideoPlaybackState): VideoPlaybackState {
  return { ...playback, loop: !playback.loop, revision: playback.revision + 1 };
}

/** Validación defensiva del protocolo Output Sync. */
export function isVideoPlayback(value: unknown): value is VideoPlaybackState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate["state"] === "playing" || candidate["state"] === "paused") &&
    typeof candidate["offsetSeconds"] === "number" &&
    Number.isFinite(candidate["offsetSeconds"]) &&
    typeof candidate["changedAtEpochMs"] === "number" &&
    Number.isFinite(candidate["changedAtEpochMs"]) &&
    typeof candidate["loop"] === "boolean" &&
    typeof candidate["revision"] === "number" &&
    Number.isInteger(candidate["revision"])
  );
}
