import type { MediaAsset } from "@/domain/media/media";
import type {
  OutputConnection,
} from "@/services/output-sync/output-subscriber";
import type {
  OutputSlide,
  OutputSnapshot,
  StageCue,
  StageProjection,
} from "@/domain/output/output-snapshot";
import { cn } from "@/lib/utils";

function legacyCue(slide: OutputSlide): StageCue {
  return {
    slideId: slide.id,
    itemId: "legacy-output",
    itemTitle: "Contenido al aire",
    itemType: null,
    content: slide.content,
    secondaryText: slide.secondaryText,
  };
}

function projectionOf(snapshot: OutputSnapshot | null): StageProjection {
  if (snapshot?.stage) return snapshot.stage;
  return {
    current: snapshot?.slide ? legacyCue(snapshot.slide) : null,
    next: null,
  };
}

function connectionLabel(connection: OutputConnection): string {
  if (connection === "connected") return "LIVE";
  if (connection === "disconnected") return "STALE · RECONECTANDO";
  return "CONECTANDO";
}

function mediaKindLabel(cue: StageCue): string | null {
  if (cue.content.kind === "image") return "IMAGEN";
  if (cue.content.kind === "video") return "VIDEO";
  return null;
}

function StageCueContent({
  cue,
  assets,
  compact = false,
}: {
  cue: StageCue;
  assets: readonly MediaAsset[];
  compact?: boolean;
}) {
  if (cue.content.kind === "text") {
    return (
      <div className="flex min-h-0 flex-col items-center justify-center text-center">
        <p
          className={cn("whitespace-pre-line text-balance font-semibold leading-[1.12]", compact && "leading-tight")}
          style={{ fontSize: compact ? "clamp(1.35rem, 3.2vmin, 3rem)" : "clamp(2rem, 6vmin, 6.5rem)" }}
        >
          {cue.content.lines.join("\n")}
        </p>
        {cue.secondaryText ? (
          <p className={cn("mt-4 font-medium text-white/65", compact ? "text-sm" : "text-[clamp(1rem,2vmin,2rem)]")}>
            {cue.secondaryText}
          </p>
        ) : null}
      </div>
    );
  }

  const mediaContent = cue.content;
  const asset = assets.find((entry) => entry.id === mediaContent.mediaId);
  return (
    <div className="flex min-h-0 flex-col items-center justify-center gap-3 text-center">
      {asset?.thumbnailDataUrl ? (
        <img
          src={asset.thumbnailDataUrl}
          alt=""
          className={cn("max-h-full max-w-full rounded-md object-contain", compact ? "h-20" : "h-[min(42vh,28rem)]")}
          draggable={false}
        />
      ) : (
        <div className={cn("grid place-items-center rounded-md border border-white/20 bg-white/5 text-white/45", compact ? "h-20 w-36 text-xs" : "aspect-video h-[min(34vh,22rem)] text-xl")}>
          Sin miniatura
        </div>
      )}
      <span className="font-mono text-xs font-semibold tracking-[0.16em] text-cyan-300">
        {mediaKindLabel(cue)}
      </span>
    </div>
  );
}

export interface StageDisplayProps {
  snapshot: OutputSnapshot | null;
  connection: OutputConnection;
  clock: string;
  assets?: readonly MediaAsset[];
}

export function StageDisplay({ snapshot, connection, clock, assets = [] }: StageDisplayProps) {
  const stage = projectionOf(snapshot);
  const current = stage.current;
  const next = stage.next;
  const mode = snapshot?.mode ?? "content";
  const nextChangesItem = Boolean(current && next && current.itemId !== next.itemId);

  return (
    <main className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_minmax(9rem,28vh)] overflow-hidden bg-[#050607] text-white" data-testid="stage-display">
      <header className="flex min-h-16 items-center gap-4 border-b border-white/15 px-[clamp(1rem,2.5vw,3rem)] py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[clamp(1rem,2vw,2rem)] font-semibold">
            {current?.itemTitle ?? "Esperando contenido"}
          </p>
          {current?.label || current?.secondaryText ? (
            <p className="truncate font-mono text-[clamp(.7rem,1.1vw,1rem)] uppercase tracking-[0.12em] text-white/55">
              {[current.label, current.secondaryText].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        {mode !== "content" ? (
          <strong className={cn("rounded-md border px-4 py-2 font-mono text-[clamp(1rem,2vw,2rem)] tracking-[0.18em]", mode === "black" ? "border-red-500 bg-red-500/20 text-red-200" : "border-amber-400 bg-amber-400/20 text-amber-100")}>
            {mode.toUpperCase()}
          </strong>
        ) : null}

        <div className="flex shrink-0 items-center gap-4">
          <span className={cn("rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em]", connection === "connected" ? "border-emerald-400/50 text-emerald-300" : connection === "disconnected" ? "border-red-400/50 text-red-300" : "border-amber-300/50 text-amber-200")}>
            {connectionLabel(connection)}
          </span>
          <time className="font-mono text-[clamp(1.25rem,2.7vw,3rem)] font-semibold tabular-nums">
            {clock}
          </time>
        </div>
      </header>

      <section className="min-h-0 overflow-hidden px-[clamp(1rem,4vw,5rem)] py-[clamp(1rem,3vh,3rem)]" aria-label="Contenido actual">
        {current ? (
          <StageCueContent cue={current} assets={assets} />
        ) : (
          <div className="grid h-full place-items-center font-mono text-xl uppercase tracking-[0.14em] text-white/35">
            Sin contenido al aire
          </div>
        )}
      </section>

      <section className="min-h-0 overflow-hidden border-t border-cyan-300/35 bg-white/[0.035] px-[clamp(1rem,3vw,3.5rem)] py-3" aria-label="Contenido siguiente">
        <div className="flex h-full min-h-0 gap-5">
          <div className="w-[clamp(6rem,12vw,11rem)] shrink-0 border-r border-white/15 pr-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Siguiente</p>
            {nextChangesItem ? <p className="mt-2 text-sm font-semibold text-white/75">{next?.itemTitle}</p> : null}
            {next?.label ? <p className="mt-1 font-mono text-xs uppercase text-white/45">{next.label}</p> : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {next ? (
              <StageCueContent cue={next} assets={assets} compact />
            ) : (
              <div className="grid h-full place-items-center font-mono text-sm uppercase tracking-[0.14em] text-white/35">
                {current ? "Fin del show" : "Sin siguiente"}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
