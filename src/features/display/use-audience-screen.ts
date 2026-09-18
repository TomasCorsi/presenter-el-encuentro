import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearAudienceScreen,
  readAudienceScreen,
  writeAudienceScreen,
} from "@/services/display/display-preference";
import {
  detectWindowManagementSupport,
  fingerprintScreen,
  matchScreen,
  readWindowManagementPermission,
  requestScreenDetails,
  subscribeScreenChanges,
  suggestAudienceScreen,
  toScreenEntries,
  type ScreenEntry,
  type ScreenFingerprint,
  type ScreenMatch,
  type WindowManagementPermission,
  type WindowManagementSupport,
} from "@/services/display/window-management";

const SSR_SUPPORT: WindowManagementSupport = {
  hasApi: false,
  secureContext: false,
  extended: null,
};

export interface AudienceScreenController {
  support: WindowManagementSupport;
  permission: WindowManagementPermission;
  /** Pantallas de la sesión actual; vacío hasta pulsar «Detectar pantallas». */
  screens: ScreenEntry[];
  detected: boolean;
  detecting: boolean;
  /** Mensaje de error de la última detección, en lenguaje del operador. */
  error: string | null;
  fingerprint: ScreenFingerprint | null;
  /** Resultado de emparejar la preferencia con las pantallas detectadas. */
  match: ScreenMatch | null;
  /** Índice propuesto automáticamente cuando hay exactamente dos pantallas. */
  suggestion: number | null;
  detect(): Promise<void>;
  save(index: number): void;
  forget(): void;
}

/**
 * Estado de la pantalla de audiencia para la UI. La primera llamada a
 * `getScreenDetails()` ocurre solo dentro de `detect()`, es decir, tras el clic
 * del operador: es lo que permite que el navegador muestre su permiso.
 */
export function useAudienceScreen(): AudienceScreenController {
  const [support, setSupport] = useState<WindowManagementSupport>(SSR_SUPPORT);
  const [permission, setPermission] = useState<WindowManagementPermission>("unknown");
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [detected, setDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<ScreenFingerprint | null>(null);

  const detailsRef = useRef<ScreenDetails | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupport(detectWindowManagementSupport());
    setFingerprint(readAudienceScreen(window.localStorage));
    void readWindowManagementPermission().then(setPermission);
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const adopt = useCallback((details: ScreenDetails) => {
    detailsRef.current = details;
    setScreens(toScreenEntries(details));
    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeScreenChanges(details, () => {
      setScreens(toScreenEntries(details));
    });
  }, []);

  const detect = useCallback(async () => {
    setDetecting(true);
    setError(null);
    try {
      const details = await requestScreenDetails();
      if (!details) {
        setScreens([]);
        setDetected(false);
        setError(
          "No se pudieron leer las pantallas. Permití la gestión de ventanas para este sitio e intentá de nuevo.",
        );
        return;
      }
      adopt(details);
      setDetected(true);
    } finally {
      setDetecting(false);
      void readWindowManagementPermission().then(setPermission);
    }
  }, [adopt]);

  const save = useCallback(
    (index: number) => {
      const entry = screens[index];
      if (!entry) return;
      const next = fingerprintScreen(entry.info);
      writeAudienceScreen(window.localStorage, next);
      setFingerprint(next);
    },
    [screens],
  );

  const forget = useCallback(() => {
    clearAudienceScreen(window.localStorage);
    setFingerprint(null);
  }, []);

  const match = useMemo(() => {
    if (!fingerprint || screens.length === 0) return null;
    return matchScreen(
      fingerprint,
      screens.map((entry) => entry.info),
    );
  }, [fingerprint, screens]);

  const suggestion = useMemo(
    () => suggestAudienceScreen(screens.map((entry) => entry.info)),
    [screens],
  );

  return {
    support,
    permission,
    screens,
    detected,
    detecting,
    error,
    fingerprint,
    match,
    suggestion,
    detect,
    save,
    forget,
  };
}
