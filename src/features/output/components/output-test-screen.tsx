import { useEffect, useState } from "react";

/**
 * Pantalla de prueba aislada (`/output/main?mode=test`).
 *
 * Deliberadamente NO se suscribe al canal de sincronización, no publica nada y
 * no toca Program: sirve para identificar una pantalla física y verificar su
 * resolución real antes de usarla como proyector.
 */
export interface OutputTestScreenProps {
  /** Número que el operador ve en Settings para esta pantalla. */
  screenNumber: string | null;
}

export function OutputTestScreen({ screenNumber }: OutputTestScreenProps) {
  const [resolution, setResolution] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setResolution(`${window.innerWidth} × ${window.innerHeight} (pantalla ${window.screen.width} × ${window.screen.height})`);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  return (
    <main
      data-testid="output-test-screen"
      className="bg-output-base text-foreground relative flex h-dvh w-full flex-col items-center justify-center gap-6 overflow-hidden"
    >
      {/* Patrón de esquinas: permite ver si la ventana cubre toda la pantalla. */}
      <div className="border-primary pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed" />

      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        Prueba de salida
      </p>
      <p className="text-[12rem] leading-none font-bold">{screenNumber ?? "?"}</p>
      <p className="font-mono text-base text-muted-foreground">{resolution ?? "—"}</p>

      <button
        type="button"
        onClick={() => window.close()}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold"
      >
        Cerrar prueba
      </button>
    </main>
  );
}
