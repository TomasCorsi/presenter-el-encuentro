import { useEffect, useState } from "react";

const IDLE_TIMEOUT_MS = 3000;

/**
 * Gestiona la UI efímera de Output: cursor y overlay visibles al mover el
 * ratón o pulsar una tecla, y ocultos tras 3 s de inactividad.
 */
export function useIdleUi(): { idle: boolean } {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const wake = () => {
      setIdle(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS);
    };

    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("mousedown", wake);
    window.addEventListener("keydown", wake);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("mousedown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  return { idle };
}
