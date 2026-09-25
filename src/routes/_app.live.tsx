import { Link, createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { mediaRemovalBlockReason } from "@/domain/presentation/presentation-program";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { BiblePassage } from "@/domain/bible/bible";
import type { MediaAsset } from "@/domain/media/media";
import type { BackgroundTransition } from "@/domain/output/output-snapshot";
import type { RundownBackground } from "@/domain/projects/rundown";
import {
  createInitialPlayback,
  pausePlayback,
  playPlayback,
  restartPlayback,
  togglePlaybackLoop,
  type VideoPlaybackState,
} from "@/domain/output/video-playback";
import type { Project } from "@/domain/projects/project";
import type { Song } from "@/domain/songs/song";
import {
  getPreviewItem,
  getProgramItem,
  getProgramSlide,
  isProgramDetached,
  getNextSlide,
  getPreviousSlide,
} from "@/domain/presentation/presentation-selectors";
import { LiveLibraryDock, type LibraryTab } from "@/features/live/components/live-library-dock";
import { LiveProgramMonitor } from "@/features/live/components/live-program-monitor";
import { LiveOperationBar } from "@/features/live/components/live-operation-bar";
import { LiveRundown } from "@/features/live/components/live-rundown";
import { LiveShowBar } from "@/features/live/components/live-show-bar";
import {
  appendToLiveSession,
  buildAppendedItem,
  buildReplacementItem,
  createLiveSession,
  isLiveSessionOutdated,
  reloadLiveSession,
  removeFromLiveSession,
  replaceInLiveSession,
  type LiveSession,
} from "@/features/live/live-session";
import { LiveSlideGrid } from "@/features/live/components/live-slide-grid";
import {
  LiveVideoControls,
  type VideoPlaybackCommand,
} from "@/features/live/components/live-video-controls";
import { useLiveKeyboard } from "@/features/live/use-live-keyboard";
import { useBible } from "@/features/bible/bible-context";
import { useMedia } from "@/features/media/media-context";
import { useOutputPublisher } from "@/features/output/use-output-publisher";
import { useOutputWindow } from "@/features/output/use-output-window";
import {
  usePresentationState,
  usePresentationStore,
} from "@/features/presentation/presentation-context";
import { usePresets } from "@/features/presets/presets-context";
import { useProjects } from "@/features/projects/projects-context";
import { useSongs } from "@/features/songs/songs-context";
import { getQuickBackgroundTarget } from "@/features/live/background-target";
import {
  BACKGROUND_PREFERENCES_KEY,
  parseBackgroundPreferences,
} from "@/features/live/background-preferences";
import {
  LIBRARY_DOCK_DEFAULT_HEIGHT,
  LIVE_WORKSPACE_MIN_HEIGHT,
  clampLibraryDockHeight,
  getLibraryDockBounds,
  persistLibraryDockPreference,
  readLibraryDockPreference,
} from "@/features/live/library-dock-height";
import { useLiveFullscreen } from "@/features/live/use-live-fullscreen";
import { useLiveLayout } from "@/features/live/use-live-layout";
import { cn } from "@/lib/utils";

const TITLE = "Live — Consola de operación en vivo";
const DESCRIPTION =
  "Consola de operación en directo: rundown, slides, program, controles fijos y biblioteca de Songs y Bible.";

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
      tab:
        parsed.tab === "bible" || parsed.tab === "media" || parsed.tab === "backgrounds"
          ? parsed.tab
          : "songs",
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
  // El PresentationProvider vive en el shell (_app.tsx), no en esta ruta.
  component: LiveConsole,
});

function LiveConsole() {
  const {
    projects,
    activeProject,
    hasLoaded,
    addSongToProject,
    addPassageToProject,
    addMediaToProject,
    removeRundownItem,
    setRundownItemBackground,
  } = useProjects();
  const { refreshVersions } = useBible();
  const { songs, hasLoaded: songsLoaded } = useSongs();
  const { presets, hasLoaded: presetsLoaded } = usePresets();
  const { assets: mediaAssets, isLoading: mediaLoading } = useMedia();
  const store = usePresentationStore();
  const state = usePresentationState();
  const layout = useLiveLayout();
  const fullscreen = useLiveFullscreen();
  const [session, setSession] = useState<LiveSession | null>(null);
  /** Reproducción del video al aire: Live es la única autoridad. */
  const [playback, setPlayback] = useState<VideoPlaybackState | null>(null);
  const [backgroundTransition, setBackgroundTransition] = useState<BackgroundTransition>("cut");

  // Preferencias locales del dock: se leen tras el montaje para no romper SSR.
  const [library, setLibrary] = useState<LibraryPreference>(DEFAULT_LIBRARY);
  const [preferredDockHeight, setPreferredDockHeight] = useState(
    LIBRARY_DOCK_DEFAULT_HEIGHT.desktop,
  );
  const [draftDockHeight, setDraftDockHeight] = useState<number | null>(null);
  const [dockRegionHeight, setDockRegionHeight] = useState<number | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dockRegionRef = useRef<HTMLDivElement | null>(null);
  const backgroundThumbnails = useMemo(
    () =>
      new Map(
        mediaAssets.flatMap((asset) =>
          asset.thumbnailDataUrl ? [[asset.id, asset.thumbnailDataUrl] as const] : [],
        ),
      ),
    [mediaAssets],
  );
  const handleGoLive = useCallback((slideId: string) => store.goLive(slideId), [store]);

  useEffect(() => {
    setLibrary(readLibraryPreference());
    setPreferredDockHeight(
      readLibraryDockPreference(window.localStorage, LIBRARY_DOCK_DEFAULT_HEIGHT[layout.density]),
    );
    setBackgroundTransition(
      parseBackgroundPreferences(window.localStorage.getItem(BACKGROUND_PREFERENCES_KEY))
        .transition,
    );
  }, [layout.density]);

  useEffect(() => {
    const region = dockRegionRef.current;
    if (!region) return;
    const measure = () => setDockRegionHeight(region.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    return () => observer.disconnect();
  }, []);

  const dockBounds = useMemo(
    () =>
      getLibraryDockBounds({
        viewportHeight: layout.height,
        availableHeight: dockRegionHeight,
        density: layout.density,
      }),
    [dockRegionHeight, layout.density, layout.height],
  );
  const libraryDockHeight = clampLibraryDockHeight(
    draftDockHeight ?? preferredDockHeight,
    dockBounds,
  );

  const commitLibraryDockHeight = useCallback((height: number) => {
    const persisted = persistLibraryDockPreference(window.localStorage, height);
    setPreferredDockHeight(persisted);
    setDraftDockHeight(null);
  }, []);

  const resetLibraryDockHeight = useCallback(() => {
    const reset = persistLibraryDockPreference(
      window.localStorage,
      LIBRARY_DOCK_DEFAULT_HEIGHT[layout.density],
    );
    setPreferredDockHeight(reset);
    setDraftDockHeight(null);
  }, [layout.density]);

  const cancelLibraryDockResize = useCallback(() => {
    setDraftDockHeight(null);
  }, []);

  // Al volver a la consola se revalida SOLO la metadata de traducciones: una
  // Biblia importada o eliminada en otra pantalla se refleja sin recargar texto.
  useEffect(() => {
    void refreshVersions();
    const onFocus = () => void refreshVersions();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshVersions]);

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
  // `/output/main` (ADR-027/028), incluido el estado de reproducción.
  useOutputPublisher(playback, backgroundTransition);
  const outputWindow = useOutputWindow();

  // Carga inicial del show: un único snapshot explícito por sesión.
  useEffect(() => {
    if (session || !hasLoaded || !songsLoaded || !presetsLoaded || mediaLoading || !activeProject)
      return;
    const next = createLiveSession({ project: activeProject, songs, presets, media: mediaAssets });
    setSession(next);
    store.loadPresentation(next.snapshot.items);
  }, [
    activeProject,
    hasLoaded,
    mediaAssets,
    mediaLoading,
    presets,
    presetsLoaded,
    session,
    songs,
    songsLoaded,
    store,
  ]);

  // La reproducción es del video AL AIRE: entra reproduciendo desde el
  // inicio y se detiene solo al cambiar la slide de Program. Clear/Black NO la
  // reinician: el video sigue avanzando internamente (ADR-024) y al volver a
  // `content` reaparece en la posición correspondiente.
  const programSlideNow = getProgramSlide(state);
  const programVideoId = programSlideNow?.content.kind === "video" ? programSlideNow.id : null;
  useEffect(() => {
    setPlayback(programVideoId ? createInitialPlayback(Date.now()) : null);
  }, [programVideoId]);

  const snapshot = session?.snapshot ?? null;
  const showProject = projects.find((project) => project.id === snapshot?.projectId) ?? null;
  const outdated = Boolean(
    session &&
    showProject &&
    isLiveSessionOutdated(session, { project: showProject, songs, presets, media: mediaAssets }),
  );
  // El handler necesita saber si YA había desfase antes de su propia alta.
  const outdatedRef = useRef(false);
  outdatedRef.current = outdated;

  const changedActiveProject =
    snapshot && activeProject && activeProject.id !== snapshot.projectId ? activeProject : null;

  const reload = useCallback(() => {
    if (!showProject) return;
    const next = reloadLiveSession({ project: showProject, songs, presets, media: mediaAssets });
    setSession(next);
    store.reloadPresentation(next.snapshot.items);
  }, [mediaAssets, presets, showProject, songs, store]);

  const loadActiveProject = useCallback(() => {
    if (!activeProject) return;
    const next = createLiveSession({ project: activeProject, songs, presets, media: mediaAssets });
    setSession(next);
    store.loadPresentation(next.snapshot.items);
  }, [activeProject, mediaAssets, presets, songs, store]);

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

        const sources = { project, songs, presets, media: mediaAssets };
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
    [mediaAssets, presets, songs, store],
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

  const handleAddMedia = useCallback(
    (asset: MediaAsset, mode: "rundown" | "live") => {
      if (!showProject) return;
      void appendFromLibrary(mode, asset.name, () =>
        addMediaToProject(showProject.id, { id: asset.id, name: asset.name }),
      );
    },
    [addMediaToProject, appendFromLibrary, showProject],
  );

  /**
   * Baja desde Live: persiste en el Project y quita SOLO ese item del runtime.
   * Si el item estaba al aire, la salida queda congelada (ADR-045).
   */
  const handleRemoveItem = useCallback(
    (itemId: string) => {
      if (!showProject) return;
      // Media al aire: bloqueado, nunca se congela (Fase 10).
      const blocked = mediaRemovalBlockReason(store.getState(), itemId);
      if (blocked) {
        setStatus(blocked);
        return;
      }
      const wasOutdated = outdatedRef.current;
      const title = state.runtime.items.find((item) => item.id === itemId)?.title ?? "El elemento";
      setBusy(true);
      setStatus(null);
      void (async () => {
        try {
          // El Project persistido trae el orden renormalizado y el updatedAt
          // nuevo: con él la firma coincide y no aparece un falso aviso.
          const project = await removeRundownItem(showProject.id, itemId);
          setSession((current) =>
            current
              ? removeFromLiveSession(current, {
                  project,
                  songs,
                  presets,
                  media: mediaAssets,
                  itemId,
                  wasOutdated,
                })
              : current,
          );
          store.removePresentationItem(itemId);
          setStatus(`${title} se quitó del rundown.`);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "No se pudo quitar el elemento.");
        } finally {
          setBusy(false);
        }
      })();
    },
    [mediaAssets, presets, removeRundownItem, showProject, songs, state.runtime.items, store],
  );

  const handleApplyBackground = useCallback(
    async (background: RundownBackground | undefined): Promise<boolean> => {
      if (!showProject) return false;
      const target = getQuickBackgroundTarget(store.getState());
      if (!target) {
        setStatus("Selecciona una Song o Bible en Preview o Program.");
        return false;
      }
      const wasOutdated = outdatedRef.current;
      setBusy(true);
      setStatus(null);
      try {
        const project = await setRundownItemBackground(showProject.id, target.id, background);
        const sources = { project, songs, presets, media: mediaAssets };
        const item = buildReplacementItem(sources, target.id);
        if (!item) throw new Error("No se pudo preparar el fondo para el show.");
        setSession((current) =>
          current ? replaceInLiveSession(current, { ...sources, item, wasOutdated }) : current,
        );
        store.replacePresentationItem(item);
        setStatus(
          background ? `Fondo aplicado a ${target.title}.` : `Fondo quitado de ${target.title}.`,
        );
        return true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo cambiar el fondo.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [mediaAssets, presets, setRundownItemBackground, showProject, songs, store],
  );

  /** Comandos del video al aire: actualizan el estado autoritativo de Live. */
  const handlePlaybackCommand = useCallback((command: VideoPlaybackCommand) => {
    setPlayback((current) => {
      if (!current) return current;
      const now = Date.now();
      if (command === "toggle-play") {
        return current.state === "playing"
          ? pausePlayback(current, now)
          : playPlayback(current, now);
      }
      if (command === "restart") return restartPlayback(current, now);
      return togglePlaybackLoop(current);
    });
  }, []);

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
    return (
      <Page>
        <p className="text-sm text-muted-foreground" role="status">
          Cargando show…
        </p>
      </Page>
    );
  }

  if (!snapshot) {
    return (
      <Page>
        <EmptyState
          icon={Radio}
          title="No hay proyecto activo"
          description="Marca un proyecto como activo para cargarlo en la consola de operación."
          actions={
            <Button asChild variant="outline">
              <Link to="/projects">Ir a Projects</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const previewItem = getPreviewItem(state);
  const programItem = getProgramItem(state);

  return (
    <Page
      data-live-workspace="true"
      data-live-density={layout.density}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        layout.short
          ? "gap-1 px-2 py-1.5"
          : layout.compact
            ? "gap-1.5 px-3 py-2"
            : layout.narrow
              ? "gap-2 px-4 py-3"
              : "gap-2 py-4 lg:px-8 lg:py-4",
      )}
    >
      <LiveShowBar
        showName={showProject?.name ?? snapshot.projectName}
        itemCount={state.runtime.items.length}
        outdated={outdated}
        activeProjectName={changedActiveProject?.name ?? null}
        outputStatus={outputWindow.status}
        outputMessage={outputWindow.message}
        compact={layout.compact}
        short={layout.short}
        fullscreenSupported={fullscreen.supported}
        fullscreen={fullscreen.fullscreen}
        fullscreenError={fullscreen.error}
        onOpenOutput={() => void outputWindow.open()}
        onToggleFullscreen={() => void fullscreen.toggle()}
        onReload={reload}
        onLoadActiveProject={loadActiveProject}
      />

      {/* Controles SIEMPRE visibles: la barra nunca se desplaza con el scroll. */}
      <LiveOperationBar
        canPrevious={
          getPreviousSlide(state) !== null ||
          (state.previewSlideId === null && state.runtime.navigableSlideIds.length > 0)
        }
        canNext={
          getNextSlide(state) !== null ||
          (state.previewSlideId === null && state.runtime.navigableSlideIds.length > 0)
        }
        canTake={canTake}
        programMode={state.programMode}
        onPrevious={onPrevious}
        onNext={onNext}
        onTake={onTake}
        onToggleMode={(mode) => store.toggleProgramMode(mode)}
        onSearch={onSearch}
        libraryOpen={library.open}
        compact={layout.compact}
        short={layout.short}
      />

      <div
        ref={dockRegionRef}
        className={cn("flex min-h-0 flex-1 flex-col", layout.compact ? "gap-1.5" : "gap-2")}
      >
        <div
          className={cn(
            "grid min-h-0 flex-1",
            layout.compact ? "gap-1.5" : "gap-2",
            layout.narrow || layout.compact
              ? "lg:grid-cols-[clamp(150px,12vw,190px)_minmax(0,1fr)_clamp(300px,27vw,400px)]"
              : "lg:grid-cols-[clamp(170px,14vw,240px)_minmax(0,1fr)_clamp(320px,30vw,520px)]",
          )}
          style={{ minHeight: LIVE_WORKSPACE_MIN_HEIGHT[layout.density] }}
        >
          <section
            aria-labelledby="live-rundown-title"
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border"
          >
            <h2
              id="live-rundown-title"
              className={cn(
                "shrink-0 border-b border-border bg-card px-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                layout.compact ? "py-1" : "py-1.5",
              )}
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
                  onRemove={handleRemoveItem}
                  removeBlockReason={(itemId) => mediaRemovalBlockReason(state, itemId)}
                  canRemove={Boolean(showProject) && !busy}
                  compact={layout.compact}
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
              className={cn(
                "flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                layout.compact ? "py-1" : "py-1.5",
              )}
            >
              Slides
              <span className="truncate normal-case tracking-normal text-foreground">
                {previewItem?.title ?? ""}
              </span>
              <span
                className={cn(
                  "ml-auto hidden normal-case tracking-normal xl:inline",
                  layout.compact && "xl:hidden",
                )}
              >
                un clic envía al aire
              </span>
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LiveSlideGrid
                item={previewItem}
                previewSlideId={state.previewSlideId}
                programSlideId={state.programSlideId}
                backgroundThumbnails={backgroundThumbnails}
                onGoLive={handleGoLive}
                compact={layout.compact}
                narrow={layout.narrow}
              />
            </div>
          </section>

          <div className="min-h-0 min-w-0 overflow-y-auto">
            <LiveProgramMonitor
              programSlide={getProgramSlide(state)}
              programItem={programItem}
              programMode={state.programMode}
              detached={isProgramDetached(state)}
              playback={playback}
              onPlaybackCommand={handlePlaybackCommand}
              backgroundTransition={backgroundTransition}
              compact={layout.compact}
            />
          </div>
        </div>

        <LiveLibraryDock
          open={library.open}
          onToggle={() => updateLibrary({ open: !library.open })}
          height={libraryDockHeight}
          heightBounds={dockBounds}
          onHeightChange={setDraftDockHeight}
          onHeightCommit={commitLibraryDockHeight}
          onHeightCancel={cancelLibraryDockResize}
          onHeightReset={resetLibraryDockHeight}
          compact={layout.compact}
          tab={library.tab}
          onTabChange={(tab) => updateLibrary({ tab })}
          inputRef={searchInputRef}
          songs={songs}
          bibleVersionId={library.versionId}
          onBibleVersionChange={(versionId) => updateLibrary({ versionId })}
          mediaAssets={mediaAssets}
          mediaLoading={mediaLoading}
          canAdd={Boolean(showProject)}
          busy={busy}
          status={status}
          onAddSong={handleAddSong}
          onAddPassage={handleAddPassage}
          onAddMedia={handleAddMedia}
          backgroundTarget={getQuickBackgroundTarget(state)}
          onBackgroundTransitionChange={setBackgroundTransition}
          onApplyBackground={handleApplyBackground}
        />
      </div>
    </Page>
  );
}
