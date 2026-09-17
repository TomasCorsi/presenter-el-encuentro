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
import { useProjects } from "@/features/projects/projects-context";
import { SongsProvider, useSongs } from "@/features/songs/songs-context";

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
    <SongsProvider>
      <PresentationProvider>
        <LiveConsole />
      </PresentationProvider>
    </SongsProvider>
  );
}

function LiveConsole() {
  const { projects, activeProject, loading } = useProjects();
  const { songs, loading: songsLoading } = useSongs();
  const store = usePresentationStore();
  const state = usePresentationState();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);

  // Carga inicial del show: un único snapshot explícito por sesión.
  useEffect(() => {
    if (snapshot || loading || songsLoading || !activeProject) return;
    const next = buildLiveSnapshot(activeProject, songs);
    setSnapshot(next);
    store.loadPresentation(next.items);
  }, [activeProject, loading, songs, songsLoading, snapshot, store]);

  const showProject = projects.find((project) => project.id === snapshot?.projectId) ?? null;
  const outdated = Boolean(
    snapshot && showProject && presentationSignature(showProject, songs) !== snapshot.signature,
  );
  const changedActiveProject =
    snapshot && activeProject && activeProject.id !== snapshot.projectId ? activeProject : null;

  const reload = useCallback(() => {
    if (!showProject) return;
    const next = buildLiveSnapshot(showProject, songs);
    setSnapshot(next);
    store.reloadPresentation(next.items);
  }, [showProject, songs, store]);

  const loadActiveProject = useCallback(() => {
    if (!activeProject) return;
    const next = buildLiveSnapshot(activeProject, songs);
    setSnapshot(next);
    store.loadPresentation(next.items);
  }, [activeProject, songs, store]);

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

  if (loading || songsLoading) {
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
    <Page className="flex h-full min-h-0 flex-col">
      <LiveShowBar
        showName={showProject?.name ?? snapshot.projectName}
        itemCount={state.runtime.items.length}
        outdated={outdated}
        activeProjectName={changedActiveProject?.name ?? null}
        onReload={reload}
        onLoadActiveProject={loadActiveProject}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section aria-labelledby="live-rundown-title" className="min-w-0 overflow-y-auto rounded-md border border-border">
          <h2 id="live-rundown-title" className="border-b border-border bg-card px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rundown
          </h2>
          {state.runtime.items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">El proyecto no tiene elementos en el rundown.</p>
          ) : (
            <LiveRundown
              items={state.runtime.items}
              previewItemId={state.previewItemId}
              programItemId={programItem?.id ?? null}
              onSelect={(itemId) => store.selectItem(itemId)}
            />
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <LiveMonitors
            previewSlide={getPreviewSlide(state)}
            previewItem={previewItem}
            programSlide={getProgramSlide(state)}
            programItem={programItem}
            programMode={state.programMode}
          />

          <section aria-labelledby="live-slides-title" className="min-w-0">
            <h2 id="live-slides-title" className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Slides
            </h2>
            <LiveSlideGrid
              item={previewItem}
              previewSlideId={state.previewSlideId}
              programSlideId={state.programSlideId}
              onSelect={(slideId) => store.selectSlide(slideId)}
            />
          </section>

          <div className="rounded-md border border-border bg-card p-2.5">
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
        </div>
      </div>
    </Page>
  );
}
