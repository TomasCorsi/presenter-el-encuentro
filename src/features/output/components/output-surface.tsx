import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import { cn } from "@/lib/utils";

/**
 * Superficie de salida de `/output/main`. Sin sidebar, topbar ni controles:
 * solo representa Program.
 *
 * Semántica de fondos (tokens semánticos, sin colores literales):
 * - Sin sesión Live válida → `bg-output-safe` (negro puro).
 * - `black` → `bg-output-safe` (negro puro).
 * - `clear` o `content` sin slide → `bg-output-base` (fondo base opaco).
 * - `content` con slide → `bg-output-base` con el texto centrado.
 */
export interface OutputSurfaceProps {
  /** `null` cuando no hay sesión Live válida. */
  snapshot: OutputSnapshot | null;
}

export function OutputSurface({ snapshot }: OutputSurfaceProps) {
  const hasSession = snapshot !== null;
  const mode = snapshot?.mode ?? null;
  const slide = mode === "content" ? (snapshot?.slide ?? null) : null;

  const pureBlack = !hasSession || mode === "black";

  return (
    <main
      data-testid="output-surface"
      className={cn(
        "flex h-dvh w-full items-center justify-center overflow-hidden",
        pureBlack ? "bg-output-safe" : "bg-output-base",
      )}
    >
      {slide ? (
        <div className="flex h-full w-full items-center justify-center p-[6vmin]">
          <p className="text-stage-foreground max-w-full text-center text-[7vmin] leading-tight font-semibold whitespace-pre-line">
            {slide.lines.join("\n")}
          </p>
        </div>
      ) : null}
    </main>
  );
}
