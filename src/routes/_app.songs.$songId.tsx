import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, Copy, ListMusic, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SONG_TITLE_MAX_LENGTH, type Song, type SongFactoryDependencies } from "@/domain/songs/song";
import { addSection, moveSection, removeSection } from "@/domain/songs/song-rules";
import { SongSectionEditor } from "@/features/songs/components/song-section-editor";
import { useSongs } from "@/features/songs/songs-context";

const TITLE = "Editor de canción — Plataforma de presentación en vivo";
const DESCRIPTION = "Edición de título, autor y secciones de una canción de la biblioteca.";
const AUTOSAVE_DELAY_MS = 600;

const draftDependencies: SongFactoryDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export const Route = createFileRoute("/_app/songs/$songId")({
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
  component: SongEditorPage,
});

type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "error";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function SongEditorPage() {
  const { songId } = Route.useParams();
  const navigate = useNavigate({ from: "/songs/$songId" });
  const songsContext = useSongs();
  const { songs, loading } = songsContext;
  const persistedSong = songs.find((item) => item.id === songId);

  // Borrador local: las ediciones son inmediatas y se marcan como dirty.
  const [draft, setDraft] = useState<Song | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Song | null>(null);
  draftRef.current = draft;

  // Sincroniza el borrador con la canción persistida sin pisar ediciones pendientes.
  useEffect(() => {
    if (!persistedSong) return;
    setDraft((current) => {
      if (!current || current.id !== persistedSong.id) return persistedSong;
      if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error") return current;
      return persistedSong;
    });
  }, [persistedSong, saveStatus]);

  const clearTimer = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    clearTimer();
    setSaveStatus("saving");
    try {
      await songsContext.saveSong(current);
      setSaveStatus("saved");
      setSavedAt(new Date());
    } catch {
      // Mantiene el estado local del editor; el usuario ve "Error al guardar".
      setSaveStatus("error");
    }
  }, [clearTimer, songsContext]);

  const markDirty = useCallback((next: Song) => {
    setDraft(next);
    setSaveStatus("dirty");
    clearTimer();
    saveTimer.current = setTimeout(() => { void flush(); }, AUTOSAVE_DELAY_MS);
  }, [clearTimer, flush]);

  const flushIfPending = useCallback(() => {
    if (saveStatus === "dirty") void flush();
  }, [flush, saveStatus]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const song = draft;

  const statusIndicator = useMemo(() => {
    switch (saveStatus) {
      case "dirty": return <StatusBadge tone="sync" showDot={false}>Cambios sin guardar</StatusBadge>;
      case "saving": return <StatusBadge tone="sync" pulse>Guardando…</StatusBadge>;
      case "saved": return <StatusBadge tone="online" showDot={false}>Guardado {savedAt ? formatTime(savedAt) : ""}</StatusBadge>;
      case "error": return <StatusBadge tone="live" showDot={false}>Error al guardar</StatusBadge>;
      default: return null;
    }
  }, [saveStatus, savedAt]);

  if (loading) {
    return <Page><p className="text-sm text-muted-foreground" role="status">Cargando canción…</p></Page>;
  }

  if (!song) {
    return (
      <Page>
        <EmptyState
          icon={ListMusic}
          title="Canción no encontrada"
          description="La canción no existe o fue eliminada de este dispositivo."
          actions={<Button asChild variant="outline"><Link to="/songs">Volver a Songs</Link></Button>}
        />
      </Page>
    );
  }

  async function handleDuplicate() {
    await flush();
    const copy = await songsContext.duplicateSong(song!.id);
    await navigate({ to: "/songs/$songId", params: { songId: copy.id } });
  }

  async function handleDelete() {
    await flush();
    await songsContext.deleteSong(song!.id);
    await navigate({ to: "/songs" });
  }

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/songs"><ArrowLeft />Songs</Link>
        </Button>
        <div aria-live="polite">{statusIndicator}</div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3 sm:max-w-xl">
          <div>
            <Label htmlFor="song-title">Título</Label>
            <Input
              id="song-title"
              value={song.title}
              onChange={(event) => markDirty({ ...song, title: event.target.value })}
              onBlur={flushIfPending}
              maxLength={SONG_TITLE_MAX_LENGTH}
              className="mt-1.5 text-base font-semibold"
            />
          </div>
          <div>
            <Label htmlFor="song-author">Autor / artista</Label>
            <Input
              id="song-author"
              value={song.author ?? ""}
              onChange={(event) => markDirty({ ...song, author: event.target.value })}
              onBlur={flushIfPending}
              maxLength={SONG_TITLE_MAX_LENGTH}
              placeholder="Opcional"
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleDuplicate().catch(() => undefined)}>
            <Copy />Duplicar
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}>
            <Trash2 />Eliminar
          </Button>
        </div>
      </div>

      <section aria-labelledby="song-dates-title" className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        <h2 id="song-dates-title" className="sr-only">Fechas de la canción</h2>
        <div className="flex items-start gap-3 bg-card p-4">
          <Calendar className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div><p className="text-xs uppercase text-muted-foreground">Creada</p><p className="mt-1 text-sm text-foreground">{formatDate(song.createdAt)}</p></div>
        </div>
        <div className="flex items-start gap-3 bg-card p-4">
          <Clock className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div><p className="text-xs uppercase text-muted-foreground">Última modificación</p><p className="mt-1 text-sm text-foreground">{formatDate(song.updatedAt)}</p></div>
        </div>
      </section>

      <section aria-labelledby="sections-title" className="mt-6 border-t border-border pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="sections-title" className="text-base font-semibold text-foreground">Letra por secciones</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada sección se convertirá en slides en una fase posterior.</p>
          </div>
          <Button size="sm" onClick={() => markDirty(addSection(song, "verse", draftDependencies))}>
            <Plus />Añadir sección
          </Button>
        </div>

        {song.sections.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Sin secciones todavía"
            description="Añade la primera sección para estructurar la letra (verso, coro, puente…)."
            actions={<Button size="sm" onClick={() => markDirty(addSection(song, "verse", draftDependencies))}><Plus />Añadir sección</Button>}
          />
        ) : (
          <div className="space-y-3">
            {song.sections.map((section, index) => (
              <SongSectionEditor
                key={section.id}
                section={section}
                isFirst={index === 0}
                isLast={index === song.sections.length - 1}
                onChange={(input) => markDirty({
                  ...song,
                  sections: song.sections.map((item) => (item.id === section.id ? { ...item, ...input } : item)),
                })}
                onBlurFlush={flushIfPending}
                onMove={(direction) => markDirty(moveSection(song, section.id, direction, draftDependencies.now))}
                onRemove={() => markDirty(removeSection(song, section.id, draftDependencies.now))}
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-md border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar canción</AlertDialogTitle>
            <AlertDialogDescription>
              “{song.title}” se eliminará de este dispositivo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete().catch(() => undefined)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
