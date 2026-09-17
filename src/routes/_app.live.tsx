import { Link, createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { BiblePassage } from "@/domain/bible/bible";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import {
  getPreviewItem,
  getPreviewSlide,
  getProgramItem,
  getProgramSlide,
  getNextSlide,
  getPreviousSlide,
} from "@/domain/presentation/presentation-selectors";
import { LiveLibraryDock, type LibraryTab } from "@/features/live/components/live-library-dock";
import { LiveMonitors } from "@/features/live/components/live-monitors";
import { LiveOperationBar } from "@/features/live/components/live-operation-bar";
import { LiveRundown } from "@/features/live/components/live-rundown";
import { LiveShowBar } from "@/features/live/components/live-show-bar";
import {
  appendToLiveSession,
  buildAppendedItem,
  createLiveSession,
  isLiveSessionOutdated,
  reloadLiveSession,
  type LiveSession,
} from "@/features/live/live-session";
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

const TITLE = "Live — Consola de operación en vivo";
const DESCRIPTION =
  "Consola de operación en directo: rundown, slides, program, preview, controles fijos y biblioteca de Songs y Bible.";

/** Preferencia LOCAL del puesto de trabajo; no forma parte del Project. */
const LIBRARY_PREFERENCE_KEY = "broadcast-control.live.library";

interface LibraryPreference {
  open: boolean;
  tab: LibraryTab;
  versionId: string | null;
}

const DEFAULT_LIBRARY: LibraryPreference = { open: true, tab: "songs", versionId: null };

function readLibraryPreference(): LibraryPreference {
  if (typeof window === "undefined") return DEFAULT_LIBRARY;
  try {
    const raw = window.localStorage.getItem(LIBRARY_PREFERENCE_KEY);
    if (!raw) return DEFAULT_LIBRARY;
    const parsed = JSON.parse(raw) as Partial<LibraryPreference>;
    return {
      open: typeof parsed.open === "boolean" ? parsed.open : DEFAULT_LIBRARY.open,
      tab: parsed.tab === "bible" ? "bible" : "songs",
      versionId: typeof parsed.versionId === "string" ? parsed.versionId : null,
    };
  } catch {
    return DEFAULT_LIBRARY;
  }
}

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
  const { projects, activeProject, hasLoaded, addSongToProject, addPassageToProject } = useProjects();
  const { songs, hasLoaded: songsLoaded } = useSongs();
  const { presets, hasLoaded: presetsLoaded } = usePresets();
  const store = usePresentationStore();
  const state = usePresentationState();
  const [session, setSession] = useState<LiveSession | null>(null);

  // Preferencias locales del dock: se leen tras el montaje para no romper SSR.
  const [library, setLibrary] = useState<LibraryPreference>(DEFAULT_LIBRARY);
  const [focusSignal, setFocusSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLibrary(readLibraryPreference());
  }, []);

  const updateLibrary = useCallback((patch: Partial<LibraryPreference>) => {
    setLibrary((current) => {
      const next = { ...current, ...patch };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LIBRARY_PREFERENCE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  // Live es la autoridad del protocolo Output Sync: publica Program a
  // `/output/main` (ADR-027/028).
  useOutputPublisher();

  // Carga inicial del show: un único snapshot explícito por sesión.
  useEffect(() => {
    if (session || !hasLoaded || !songsLoaded || !presetsLoaded || !activeProject) return;
    const next = createLiveSession({ project: activeProject, songs, presets });
    setSession(next);
    store.loadPresentation(next.snapshot.items);
  }, [activeProject, hasLoaded, presets, presetsLoaded, session, songs, songsLoaded, store]);

  const snapshot = session?.snapshot ?? null;
  const showProject = projects.find((project) => project.id === snapshot?.projectId) ?? null;
  const outdated = Boolean(
    session && showProject && isLiveSessionOutdated(session, { project: showProject, songs, presets }),
  );
  // El handler necesita saber si YA había desfase antes de su propia alta.
  const outdatedRef = useRef(false);
  outdatedRef.current = outdated;

  const changedActiveProject =
    snapshot && activeProject && activeProject.id !== snapshot.projectId ? activeProject : null;

  const reload = useCallback(() => {
    if (!showProject) return;
    const next = reloadLiveSession({ project: showProject, songs, presets });
    setSession(next);
    store.reloadPresentation(next.snapshot.items);
  }, [presets, showProject, songs, store]);

  const loadActiveProject = useCallback(() => {
    if (!activeProject) return;
    const next = createLiveSession({ project: activeProject, songs, presets });
    setSession(next);
    store.loadPresentation(next.snapshot.items);
  }, [activeProject, presets, songs, store]);

  /**
   * Alta desde la biblioteca: persiste en el Project y añade SOLO ese item al
   * runtime. Nunca reconstruye el resto del show, así que un cambio externo
   * pendiente sigue pendiente (ADR-043).
   */
  const appendFromLibrary = useCallback(
    async (mode: "rundown" | "live", label: string, save: () => Promise<Project>) => {
      const wasOutdated = outdatedRef.current;
      setBusy(true);
      setStatus(null);
      try {
        const project = await save();
        const rundownItem = [...project.rundown].sort((a, b) => a.order - b.order).at(-1);
        if (!rundownItem) return;

        const sources = { project, songs, presets };
        const item = buildAppendedItem(sources, rundownItem.id);
        if (!item) {
          setStatus("No se pudo preparar el contenido para el show.");
          return;
        }

        setSession((current) =>
          current ? appendToLiveSession(current, { ...sources, item, wasOutdated }) : current,
        );
        store.appendPresentationItem(item);

        const first = item.slides[0];
        if (mode === "live" && first) store.goLive(first.id);
        setStatus(mode === "live" ? `${label} está al aire.` : `${label} se agregó al rundown.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo agregar el contenido.");
      } finally {
        setBusy(false);
      }
    },
    [presets, songs, store],
  );

  const handleAddSong = useCallback(
    (song: Song, mode: "rundown" | "live") => {
      if (!showProject) return;
      void appendFromLibrary(mode, song.title, () =>
        addSongToProject(showProject.id, { id: song.id, title: song.title }),
      );
    },
    [addSongToProject, appendFromLibrary, showProject],
  );

  const handleAddPassage = useCallback(
    (passage: BiblePassage, mode: "rundown" | "live") => {
      if (!showProject) return;
      void appendFromLibrary(mode, passage.reference, () =>
        addPassageToProject(showProject.id, passage),
      );
    },
    [addPassageToProject, appendFromLibrary, showProject],
  );

  const canTake = state.previewSlideId !== null;
  const onPrevious = useCallback(() => store.previous(), [store]);
  const onNext = useCallback(() => store.next(), [store]);
  const onTake = useCallback(() => store.take(), [store]);
  const onBlack = useCallback(() => store.toggleProgramMode("black"), [store]);
  const onClear = useCallback(() => store.toggleProgramMode("clear"), [store]);

  const onSearch = useCallback(() => {
    updateLibrary({ open: true });
    setFocusSignal((value) => value + 1);
  }, [updateLibrary]);

  const onEscape = useCallback(() => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active instanceof HTMLElement && searchInputRef.current === active) {
      active.blur();
      return;
    }
    if (library.open) updateLibrary({ open: false });
  }, [library.open, updateLibrary]);

  // El foco llega después de que el dock se haya abierto y pintado su input.
  useEffect(() => {
    if (focusSignal === 0 || !library.open) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [focusSignal, library.open, library.tab]);

  useLiveKeyboard({
    onPrevious,
    onNext,
    onTake,
    onBlack,
    onClear,
    onSearch,
    onEscape,
    // La biblioteca también se abre con `/` en un show todavía vacío; los
    // comandos de navegación son no-op cuando no hay slides.
    enabled: Boolean(session),
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

      {/* Controles SIEMPRE visibles: la barra nunca se desplaza con el scroll. */}
      <LiveOperationBar
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
        onSearch={onSearch}
        libraryOpen={library.open}
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
            <span className="ml-auto hidden normal-case tracking-normal xl:inline">
              un clic envía al aire
            </span>
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LiveSlideGrid
              item={previewItem}
              previewSlideId={state.previewSlideId}
              programSlideId={state.programSlideId}
              onGoLive={(slideId) => store.goLive(slideId)}
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

      <LiveLibraryDock
        open={library.open}
        onToggle={() => updateLibrary({ open: !library.open })}
        tab={library.tab}
        onTabChange={(tab) => updateLibrary({ tab })}
        inputRef={searchInputRef}
        songs={songs}
        bibleVersionId={library.versionId}
        onBibleVersionChange={(versionId) => updateLibrary({ versionId })}
        canAdd={Boolean(showProject)}
        busy={busy}
        status={status}
        onAddSong={handleAddSong}
        onAddPassage={handleAddPassage}
      />
    </Page>
  );
}
