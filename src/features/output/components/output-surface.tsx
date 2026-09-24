import type { OutputSnapshot } from "@/domain/output/output-snapshot";
import { PresentationSurface } from "@/features/presentation/components/presentation-surface";
import { cn } from "@/lib/utils";

/**
 * Superficie de salida de `/output/main`. Sin sidebar, topbar ni controles:
 * solo representa Program.
 *
 * Semántica de fondos (tokens semánticos, sin colores literales):
 * - Sin sesión Live válida → `bg-output-safe` (negro puro).
 * - `black` → `bg-output-safe` (negro puro).
 * - `clear` o `content` sin slide → `bg-output-base` (fondo base opaco).
 * - `content` con slide → el renderer común pinta la slide con su Preset.
 *
 * `clear` y `black` son modos de salida y NO dependen del Preset (ADR-024).
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
        "h-dvh w-full overflow-hidden",
        slide ? "" : pureBlack ? "bg-output-safe" : "bg-output-base",
      )}
    >
      {slide ? (
        <PresentationSurface
          content={slide.content}
          style={slide.style}
          background={slide.background}
          secondaryText={slide.secondaryText}
          transition={snapshot?.backgroundTransition ?? "cut"}
          playback={slide.content.kind === "video" ? slide.playback : undefined}
          audio={slide.content.kind === "video"}
          data-testid="output-presentation-surface"
        />
      ) : null}
    </main>
  );
}
