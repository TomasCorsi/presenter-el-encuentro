import { useEffect } from "react";

export interface LiveKeyboardHandlers {
  onPrevious(): void;
  onNext(): void;
  onTake(): void;
  /** Los atajos solo actúan cuando hay un show cargado. */
  enabled: boolean;
}

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Devuelve `true` cuando el evento NO debe interpretarse como atajo de Live.
 * Exportado para poder probar la regla sin montar React.
 */
export function shouldIgnoreLiveKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return target.closest("[role='dialog']") !== null;
}

/**
 * Atajos de operación. Solo se registran mientras la consola Live está
 * montada; nunca interceptan teclas en el resto de la aplicación.
 */
export function useLiveKeyboard({ onPrevious, onNext, onTake, enabled }: LiveKeyboardHandlers): void {
  useEffect(() => {
    if (!enabled) return;

    function handle(event: KeyboardEvent): void {
      if (shouldIgnoreLiveKey(event)) return;

      const action =
        event.key === "ArrowLeft" ? onPrevious
        : event.key === "ArrowRight" ? onNext
        : event.key === "Enter" || event.key === " " ? onTake
        : null;

      if (!action) return;

      // Solo se previene el comportamiento por defecto cuando el atajo se
      // ejecuta de verdad: evita scroll con Space y flechas.
      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enabled, onNext, onPrevious, onTake]);
}
