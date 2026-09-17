import { Link, createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPreviewItem,
  getPreviewSlide,
  getProgramItem,
  getProgramSlide,
  getNextSlide,
  getPreviousSlide,
} from "@/domain/presentation/presentation-selectors";
import { LiveControls } from "@/features/live/components/live-controls";
import { LiveMonitors } from "@/features/live/components/live-monitors";
import { LiveRundown } from "@/features/live/components/live-rundown";
import { LiveShowBar } from "@/features/live/components/live-show-bar";
import {
  buildLiveSnapshot,
  presentationSignature,
  type LiveSnapshot,
} from "@/features/live/live-presentation";
import { LiveSlideGrid } from "@/features/live/components/live-slide-grid";
import { useLiveKeyboard } from "@/features/live/use-live-keyboard";
import { useOutputPublisher } from "@/features/output/use-output-publisher";
import {
  PresentationProvider,
  usePresentationState,
  usePresentationStore,
} from "@/features/presentation/presentation-context";
import { usePresets } from "@/features/presets/presets-context";
import { useProjects } from "@/features/projects/projects-context";
import { useSongs } from "@/features/songs/songs-context";

const TITLE = "Live — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Consola de operación en directo: rundown, preview, program y controles de salida.";

export const Route = createFileRoute("/_app/live")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  return (
    <PresentationProvider>
      <LiveConsole />
    </PresentationProvider>
  );
}

function LiveConsole() {
  const { projects, activeProject, hasLoaded } = useProjects();
  const { songs, hasLoaded: songsLoaded } = useSongs();
  const { presets, hasLoaded: presetsLoaded } = usePresets();
  const store = usePresentationStore();
  const state = usePresentationState();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);

  // Live es la autoridad del protocolo Output Sync: publica Program a
  // `/output/main` (ADR-027/028).
  useOutputPublisher();

  // Carga inicial del show: un único snapshot explícito por sesión.
  useEffect(() => {
    if (snapshot || !hasLoaded || !songsLoaded || !presetsLoaded || !activeProject) return;
    const next = buildLiveSnapshot(activeProject, songs, presets);
    setSnapshot(next);
    store.loadPresentation(next.items);
  }, [activeProject, hasLoaded, presets, presetsLoaded, songs, songsLoaded, snapshot, store]);

  const showProject = projects.find((project) => project.id === snapshot?.projectId) ?? null;
  const outdated = Boolean(
    snapshot &&
      showProject &&
      presentationSignature(showProject, songs, presets) !== snapshot.signature,
  );
  const changedActiveProject =
    snapshot && activeProject && activeProject.id !== snapshot.projectId ? activeProject : null;

  const reload = useCallback(() => {
    if (!showProject) return;
    const next = buildLiveSnapshot(showProject, songs, presets);
    setSnapshot(next);
    store.reloadPresentation(next.items);
  }, [presets, showProject, songs, store]);

  const loadActiveProject = useCallback(() => {
    if (!activeProject) return;
    const next = buildLiveSnapshot(activeProject, songs, presets);
    setSnapshot(next);
    store.loadPresentation(next.items);
  }, [activeProject, presets, songs, store]);

  const canTake = state.previewSlideId !== null;
  const onPrevious = useCallback(() => store.previous(), [store]);
  const onNext = useCallback(() => store.next(), [store]);
  const onTake = useCallback(() => store.take(), [store]);

  useLiveKeyboard({
    onPrevious,
    onNext,
    onTake,
    enabled: Boolean(snapshot) && state.runtime.items.length > 0,
  });

  if (!hasLoaded || !songsLoaded || !presetsLoaded) {
    return <Page><p className="text-sm text-muted-foreground" role="status">Cargando show…</p></Page>;
  }

  if (!snapshot) {
    return (
      <Page>
        <EmptyState
          icon={Radio}
          title="No hay proyecto activo"
          description="Marca un proyecto como activo para cargarlo en la consola de operación."
          actions={<Button asChild variant="outline"><Link to="/projects">Ir a Projects</Link></Button>}
        />
      </Page>
    );
  }

  const previewItem = getPreviewItem(state);
  const programItem = getProgramItem(state);

  return (
    <Page className="flex h-full min-h-0 flex-col gap-2 py-4 lg:py-4">
      <LiveShowBar
        showName={showProject?.name ?? snapshot.projectName}
        itemCount={state.runtime.items.length}
        outdated={outdated}
        activeProjectName={changedActiveProject?.name ?? null}
        onReload={reload}
        onLoadActiveProject={loadActiveProject}
      />

      {/*
        Anchos como objetivo, no como restricción: `clamp` deja que Rundown y la
        columna de monitores se compriman en 1366×768 sin sacrificar la rejilla
        de slides, que es la zona con prioridad visual.
      */}
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[clamp(170px,15vw,260px)_minmax(0,1fr)_clamp(230px,22vw,340px)]">
        <section
          aria-labelledby="live-rundown-title"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border"
        >
          <h2
            id="live-rundown-title"
            className="shrink-0 border-b border-border bg-card px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Rundown
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {state.runtime.items.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                El proyecto no tiene elementos en el rundown.
              </p>
            ) : (
              <LiveRundown
                items={state.runtime.items}
                previewItemId={state.previewItemId}
                programItemId={programItem?.id ?? null}
                onSelect={(itemId) => store.selectItem(itemId)}
              />
            )}
          </div>
        </section>

        <section
          aria-labelledby="live-slides-title"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border"
        >
          <h2
            id="live-slides-title"
            className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Slides
            <span className="truncate normal-case tracking-normal text-foreground">
              {previewItem?.title ?? ""}
            </span>
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LiveSlideGrid
              item={previewItem}
              previewSlideId={state.previewSlideId}
              programSlideId={state.programSlideId}
              onSelect={(slideId) => store.selectSlide(slideId)}
            />
          </div>
        </section>

        <div className="min-h-0 min-w-0 overflow-y-auto">
          <LiveMonitors
            previewSlide={getPreviewSlide(state)}
            previewItem={previewItem}
            programSlide={getProgramSlide(state)}
            programItem={programItem}
            programMode={state.programMode}
          />
        </div>
      </div>

      <div className="shrink-0 rounded-md border border-border bg-card px-2 py-1.5">
        <LiveControls
          canPrevious={getPreviousSlide(state) !== null
            || (state.previewSlideId === null && state.runtime.navigableSlideIds.length > 0)}
          canNext={getNextSlide(state) !== null
            || (state.previewSlideId === null && state.runtime.navigableSlideIds.length > 0)}
          canTake={canTake}
          programMode={state.programMode}
          onPrevious={onPrevious}
          onNext={onNext}
          onTake={onTake}
          onToggleMode={(mode) => store.toggleProgramMode(mode)}
        />
      </div>
    </Page>
  );
}
