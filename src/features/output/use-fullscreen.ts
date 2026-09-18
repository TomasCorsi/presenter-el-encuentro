import { useCallback, useEffect, useState } from "react";

import { requestScreenDetails } from "@/services/display/window-management";

/**
 * Pantalla completa de la salida.
 *
 * Nunca se intenta al cargar: los navegadores solo la conceden tras un gesto.
 * Cuando el permiso de gestión de ventanas ya está concedido se vuelve a pedir
 * `getScreenDetails()` para pasar `currentScreen` —la ventana ya está sobre el
 * proyector— y así el fullscreen se queda en esa pantalla. Si no se puede, se
 * degrada sin la opción `screen`.
 */
export function useFullscreen(): { fullscreen: boolean; enter: () => Promise<void> } {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enter = useCallback(async () => {
    const element = document.documentElement;
    if (!element.requestFullscreen) return;

    let screen: ScreenDetailed | undefined;
    try {
      const details = await requestScreenDetails();
      screen = details?.currentScreen;
    } catch {
      screen = undefined;
    }

    if (screen) {
      try {
        await element.requestFullscreen({ navigationUI: "hide", screen });
        return;
      } catch {
        // El navegador no acepta la opción `screen`: se degrada.
      }
    }

    try {
      await element.requestFullscreen({ navigationUI: "hide" });
    } catch {
      try {
        await element.requestFullscreen();
      } catch {
        // Sin pantalla completa: la salida sigue funcionando en ventana.
      }
    }
  }, []);

  return { fullscreen, enter };
}
