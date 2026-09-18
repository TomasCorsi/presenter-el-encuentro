import { useCallback, useEffect, useRef, useState } from "react";

import { readAudienceScreen } from "@/services/display/display-preference";
import {
  detectWindowManagementSupport,
  matchScreen,
  requestScreenDetails,
  subscribeScreenChanges,
  toScreenEntries,
} from "@/services/display/window-management";

import {
  browserOpenWindow,
  openOutputWindow,
  rectFromScreen,
  type OutputWindowLike,
} from "./open-output-window";

/** Cada cuánto se comprueba que la ventana de salida sigue abierta. */
const CLOSED_POLL_MS = 2000;

export type OutputWindowStatus =
  | "closed"
  | "open"
  | "blocked"
  | "unidentified"
  | "disconnected";

export interface OutputWindowController {
  status: OutputWindowStatus;
  /** Aviso para el operador; `null` cuando no hay nada que explicar. */
  message: string | null;
  /** `true` cuando no hay proyector configurado y la salida se abre suelta. */
  manualPlacement: boolean;
  open(): Promise<void>;
}

const BLOCKED_MESSAGE =
  "El navegador bloqueó la salida. Permití ventanas emergentes para este sitio y volvé a intentarlo.";
const MANUAL_MESSAGE = "Mové esta ventana al proyector y presioná F para pantalla completa.";
const UNIDENTIFIED_MESSAGE =
  "Proyector no identificado. Volvé a detectar las pantallas en Settings.";
const DISCONNECTED_MESSAGE = "Proyector desconectado. La salida actual no se modificó.";

/**
 * Abre `/output/main` sobre la pantalla configurada y mantiene un estado veraz
 * de esa ventana: si el operador la cierra a mano, Live deja de decir que está
 * abierta. Nunca abre la salida en la pantalla principal cuando el proyector
 * configurado no aparece.
 */
export function useOutputWindow(): OutputWindowController {
  const [status, setStatus] = useState<OutputWindowStatus>("closed");
  const [message, setMessage] = useState<string | null>(null);
  const [manualPlacement, setManualPlacement] = useState(false);

  const windowRef = useRef<OutputWindowLike | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Limpieza verificable: timer y listeners mueren al desmontar Live.
  useEffect(() => {
    const timer = setInterval(() => {
      const target = windowRef.current;
      if (target && target.closed) {
        windowRef.current = null;
        setStatus("closed");
        setMessage(null);
      }
    }, CLOSED_POLL_MS);

    return () => {
      clearInterval(timer);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const open = useCallback(async () => {
    const support = detectWindowManagementSupport();
    const fingerprint = readAudienceScreen(window.localStorage);

    // Modo alternativo: sin API o sin proyector configurado, ventana suelta.
    if (!support.hasApi || !fingerprint) {
      const result = openOutputWindow({ rect: null, open: browserOpenWindow });
      if (result.status === "blocked") {
        setStatus("blocked");
        setMessage(BLOCKED_MESSAGE);
        return;
      }
      windowRef.current = result.window;
      setStatus("open");
      setManualPlacement(true);
      setMessage(MANUAL_MESSAGE);
      return;
    }

    const details = await requestScreenDetails();
    if (!details) {
      setStatus("unidentified");
      setMessage(UNIDENTIFIED_MESSAGE);
      return;
    }

    const entries = toScreenEntries(details);
    const result = matchScreen(
      fingerprint,
      entries.map((entry) => entry.info),
    );

    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeScreenChanges(details, () => {
      const current = toScreenEntries(details).map((entry) => entry.info);
      const again = matchScreen(fingerprint, current);
      if (again.index === null) {
        // El proyector desapareció: se avisa, pero Program y la ventana ya
        // abierta no se tocan.
        setStatus("disconnected");
        setMessage(again.status === "ambiguous" ? UNIDENTIFIED_MESSAGE : DISCONNECTED_MESSAGE);
      }
    });

    if (result.index === null) {
      setStatus(result.status === "ambiguous" ? "unidentified" : "disconnected");
      setMessage(result.status === "ambiguous" ? UNIDENTIFIED_MESSAGE : DISCONNECTED_MESSAGE);
      return;
    }

    const entry = entries[result.index]!;
    const opened = openOutputWindow({
      rect: rectFromScreen(entry.info),
      open: browserOpenWindow,
    });

    if (opened.status === "blocked") {
      setStatus("blocked");
      setMessage(BLOCKED_MESSAGE);
      return;
    }

    windowRef.current = opened.window;
    setManualPlacement(false);
    setStatus("open");
    setMessage(null);
  }, []);

  return { status, message, manualPlacement, open };
}
