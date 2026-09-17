import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Music, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterSongs } from "@/domain/songs/song-rules";
import { SongDialog } from "@/features/songs/components/song-dialog";
import { SongList } from "@/features/songs/components/song-list";
import { useSongs } from "@/features/songs/songs-context";

const TITLE = "Songs — Plataforma de presentación en vivo";
const DESCRIPTION = "Biblioteca local de canciones reutilizables con letra estructurada en secciones.";

export const Route = createFileRoute("/_app/songs/")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SongsPage,
});

function SongsPage() {
  const { songs, loading, error, clearError, createSong, duplicateSong, deleteSong } = useSongs();
  const navigate = useNavigate({ from: "/songs/" });
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const visibleSongs = useMemo(() => filterSongs(songs, query), [songs, query]);

  async function handleCreate(title: string, author?: string) {
    const song = await createSong(title, author);
    await navigate({ to: "/songs/$songId", params: { songId: song.id } });
  }

  return (
    <Page>
      <PageHeader eyebrow="Contenido" title="Songs" description="Biblioteca de canciones guardadas en este dispositivo."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus />Crear canción</Button>} />
      {error ? (
        <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span><Button variant="ghost" size="sm" onClick={clearError}>Cerrar</Button>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground" role="status">Cargando canciones…</p> : songs.length === 0 ? (
        <EmptyState icon={Music} title="No hay canciones todavía" description="Crea una canción para comenzar a armar la biblioteca."
          actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus />Crear canción</Button>} />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o autor" aria-label="Buscar canciones" className="pl-9" />
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">{visibleSongs.length} de {songs.length} canciones</p>
          </div>
          <SongList songs={visibleSongs} hasQuery={Boolean(query.trim())}
            onDuplicate={async (id) => { await duplicateSong(id); }} onDelete={deleteSong} />
        </>
      )}
      <SongDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} />
    </Page>
  );
}
