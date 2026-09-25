import { useCallback, useEffect, useState } from "react";

export interface LiveFullscreenState {
  supported: boolean;
  fullscreen: boolean;
  error: string | null;
  toggle(): Promise<void>;
}

function fullscreenSupported(): boolean {
  return Boolean(
    typeof document !== "undefined" &&
    document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function" &&
    typeof document.exitFullscreen === "function",
  );
}

/** Fullscreen del workspace principal; no comparte política con Output. */
export function useLiveFullscreen(): LiveFullscreenState {
  const [supported, setSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    const reportError = () => {
      sync();
      setError("El navegador no pudo activar la pantalla completa.");
    };

    setSupported(fullscreenSupported());
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("fullscreenerror", reportError);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("fullscreenerror", reportError);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!fullscreenSupported()) return;
    setError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreen(document.fullscreenElement !== null);
      setError("El navegador no pudo activar la pantalla completa.");
    }
  }, []);

  return { supported, fullscreen, error, toggle };
}
