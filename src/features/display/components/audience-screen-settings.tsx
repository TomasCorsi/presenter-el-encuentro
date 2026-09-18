import { Monitor, MonitorCheck, RefreshCw, ScanEye, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAudienceScreen } from "@/features/display/use-audience-screen";
import {
  browserOpenWindow,
  OUTPUT_TEST_PATH,
  openOutputWindow,
  rectFromScreen,
  type OutputWindowLike,
} from "@/features/output/open-output-window";
import type { ScreenInfo } from "@/services/display/window-management";
import { cn } from "@/lib/utils";

/** La ventana de identificación se cierra sola; el botón es el respaldo. */
const IDENTIFY_MS = 6000;

/**
 * Sección «Pantalla del proyector» de Settings. Toda la interacción con la API
 * del navegador pasa por el servicio de gestión de ventanas; aquí solo vive la
 * presentación y la secuencia de acciones del operador.
 */
export function AudienceScreenSettings() {
  const {
    support, permission, screens, detected, detecting, error, fingerprint, match, suggestion,
    detect, save, forget,
  } = useAudienceScreen();

  const [notice, setNotice] = useState<string | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const identifyRef = useRef<OutputWindowLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeIdentify = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    try {
      identifyRef.current?.close?.();
    } catch {
      // La ventana ya no existe: nada que cerrar.
    }
    identifyRef.current = null;
  }, []);

  // Nunca quedan ventanas de identificación abiertas al salir de Settings.
  useEffect(() => closeIdentify, [closeIdentify]);

  const openOnScreen = useCallback(
    (info: ScreenInfo, index: number) => {
      closeIdentify();
      const result = openOutputWindow({
        url: `${OUTPUT_TEST_PATH}&n=${index + 1}`,
        name: `audience-identify-${index + 1}`,
        rect: rectFromScreen(info),
        open: browserOpenWindow,
      });

      if (result.status === "blocked") {
        setNotice(
          `El navegador bloqueó la ventana de la pantalla ${index + 1}. Permití ventanas emergentes para este sitio y probá de a una pantalla por vez.`,
        );
        return;
      }

      identifyRef.current = result.window;
      setNotice(`Mostrando el número ${index + 1} en esa pantalla.`);
      timerRef.current = setTimeout(closeIdentify, IDENTIFY_MS);
    },
    [closeIdentify],
  );

  const matchedIndex = match?.index ?? null;
  const configured = fingerprint !== null;

  const statusLabel = !configured
    ? "No configurada"
    : matchedIndex !== null
      ? "Configurada"
      : detected
        ? match?.status === "ambiguous"
          ? "Proyector no identificado"
          : "Proyector desconectado"
        : "Configurada (sin detectar)";

  const statusTone = !configured
    ? "neutral"
    : matchedIndex !== null
      ? "online"
      : detected
        ? "offline"
        : "neutral";

  const showSuggestion =
    detected && !suggestionDismissed && suggestion !== null && matchedIndex === null;

  return (
    <section aria-labelledby="audience-screen-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="audience-screen-title" className="text-base font-semibold text-foreground">
          Pantalla del proyector
        </h2>
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        {detected ? (
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {screens.length} pantallas detectadas
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Elegí en qué pantalla se abre la salida. La detección pide permiso al navegador la primera
        vez, por eso empieza cuando pulsás «Detectar pantallas».
      </p>

      {!support.hasApi ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Este navegador no puede ubicar la salida por vos. Abrí la salida y movela al proyector, y
          presioná F para pantalla completa. En Chrome o Edge sobre Windows sí funciona la detección.
        </p>
      ) : null}

      {support.hasApi && !support.secureContext ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          La detección de pantallas necesita una conexión segura (HTTPS) o ejecutarse en este mismo
          equipo.
        </p>
      ) : null}

      {permission === "denied" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Bloqueaste la gestión de ventanas para este sitio. Habilitala en los permisos del navegador
          y volvé a detectar.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void detect()} disabled={detecting}>
          <RefreshCw />
          {detecting ? "Detectando…" : "Detectar pantallas"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={matchedIndex === null}
          onClick={() => {
            const entry = matchedIndex === null ? null : screens[matchedIndex];
            if (entry) openOnScreen(entry.info, matchedIndex!);
          }}
        >
          <ScanEye />Probar salida
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!configured}
          onClick={() => {
            forget();
            setSuggestionDismissed(false);
            setNotice("Se olvidó la pantalla configurada.");
          }}
        >
          <Trash2 />Olvidar configuración
        </Button>
        {identifyRef.current ? (
          <Button variant="outline" size="sm" onClick={closeIdentify}>
            Cerrar identificación
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {showSuggestion ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span>
            Se detectaron dos pantallas. ¿Usar «{screens[suggestion]?.info.label || `Pantalla ${suggestion + 1}`}» como
            proyector?
          </span>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              save(suggestion);
              setSuggestionDismissed(true);
              setNotice("Pantalla del proyector guardada.");
            }}
          >
            Confirmar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSuggestionDismissed(true)}>
            Elegir otra
          </Button>
        </div>
      ) : null}

      {detected && screens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se detectó ninguna pantalla.</p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {screens.map((entry, index) => {
          const isAudience = matchedIndex === index;
          return (
            <li
              key={`${entry.info.label}-${entry.info.availLeft}-${entry.info.availTop}-${index}`}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md border px-3 py-2",
                isAudience ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              {isAudience ? (
                <MonitorCheck className="size-4 text-primary" />
              ) : (
                <Monitor className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {index + 1}. {entry.info.label || `Pantalla ${index + 1}`}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {entry.info.width} × {entry.info.height} · posición {entry.info.availLeft},
                {entry.info.availTop} · escala {entry.info.devicePixelRatio}
              </span>
              {entry.info.isPrimary ? <StatusBadge tone="neutral">Principal</StatusBadge> : null}
              {isAudience ? <StatusBadge tone="online">Proyector</StatusBadge> : null}

              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openOnScreen(entry.info, index)}>
                  Identificar
                </Button>
                <Button
                  variant={isAudience ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    save(index);
                    setSuggestionDismissed(true);
                    setNotice("Pantalla del proyector guardada.");
                  }}
                >
                  Usar como proyector
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {configured && detected && matchedIndex === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {match?.status === "ambiguous"
            ? "Hay varias pantallas parecidas y no se puede saber cuál es el proyector. Elegí una otra vez."
            : "La pantalla configurada no está conectada. Conectala o elegí otra."}
        </p>
      ) : null}
    </section>
  );
}
