import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { BibleBookMeta, BibleChapter, BibleVersionMeta } from "@/domain/bible/bible";
import { buildPassage, parseBibleReference, verseRange } from "@/domain/bible/bible-reference";
import { useBible } from "@/features/bible/bible-context";
import { BiblePassagePanel } from "@/features/bible/components/bible-passage-panel";
import { useProjects } from "@/features/projects/projects-context";
import { cn } from "@/lib/utils";

const TITLE = "Navegar Biblia — Plataforma de presentación en vivo";
const DESCRIPTION = "Libros, capítulos y versículos de una Biblia instalada, listos para proyectar.";

export const Route = createFileRoute("/_app/bible/$versionId")({
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
  component: BibleNavigatorPage,
});

function BibleNavigatorPage() {
  const { versionId } = Route.useParams();
  const { versions, hasLoaded, getBooks, getChapter } = useBible();
  const { projects, activeProjectId, addPassageToProject } = useProjects();

  const version = useMemo<BibleVersionMeta | undefined>(
    () => versions.find((item) => item.id === versionId),
    [versionId, versions],
  );

  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [bookUsfm, setBookUsfm] = useState<string | null>(null);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBooks(versionId)
      .then((loaded) => {
        if (cancelled) return;
        setBooks(loaded);
        setBookUsfm((current) => current ?? loaded[0]?.usfm ?? null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [getBooks, versionId]);

  const book = books.find((item) => item.usfm === bookUsfm) ?? null;

  const openChapter = useCallback(
    async (usfm: string, number: string, verseNumbers?: readonly string[]) => {
      const loaded = await getChapter(versionId, usfm, number).catch(() => null);
      setBookUsfm(usfm);
      setChapter(loaded);
      setSelection(verseNumbers ? [...verseNumbers] : []);
      setAnchor(null);
    },
    [getChapter, versionId],
  );

  // Al cambiar de libro se abre su primer capítulo automáticamente.
  useEffect(() => {
    if (!book) return;
    if (chapter && chapter.bookUsfm === book.usfm) return;
    const first = book.chapterNumbers[0];
    if (first) void openChapter(book.usfm, first);
  }, [book, chapter, openChapter]);

  function handleVerseClick(number: string, shiftKey: boolean) {
    if (!chapter) return;
    if (shiftKey && anchor) {
      setSelection(verseRange(chapter.verses, anchor, number));
      return;
    }
    setAnchor(number);
    setSelection([number]);
  }

  async function handleReferenceSubmit() {
    const reference = parseBibleReference(query, books);
    if (!reference) {
      setQueryError("No se reconoce esa referencia. Prueba con “Juan 3:16” o “Juan 3:16-18”.");
      return;
    }
    setQueryError(null);

    const verses: string[] = [];
    if (reference.from) {
      const from = Number.parseInt(reference.from, 10);
      const to = reference.to ? Number.parseInt(reference.to, 10) : from;
      for (let value = Math.min(from, to); value <= Math.max(from, to); value += 1) {
        verses.push(String(value));
      }
    }
    await openChapter(reference.bookUsfm, reference.chapter, verses);
  }

  const passage = useMemo(() => {
    if (!version || !book || !chapter) return null;
    return buildPassage({ version, book, chapter, verseNumbers: selection });
  }, [book, chapter, selection, version]);

  if (!hasLoaded) {
    return <Page><p role="status" className="text-sm text-muted-foreground">Cargando Biblia…</p></Page>;
  }

  if (!version) {
    return (
      <Page>
        <EmptyState
          icon={BookOpen}
          title="Biblia no encontrada"
          description="Esta traducción no está instalada en el dispositivo."
          actions={<Button asChild variant="outline"><Link to="/bible">Volver a Bible</Link></Button>}
        />
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/bible"><ArrowLeft />Bible</Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={version.abbreviation}
        title={version.title}
        description="Selecciona un versículo o arrastra con Mayús para tomar un rango."
      />

      <form
        className="mb-4 flex max-w-md gap-2"
        onSubmit={(event) => { event.preventDefault(); void handleReferenceSubmit(); }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Juan 3:16-18"
          aria-label="Buscar una referencia"
        />
        <Button type="submit" variant="outline">Ir</Button>
      </form>
      {queryError ? <p role="alert" className="-mt-2 mb-4 text-sm text-destructive">{queryError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[200px_120px_minmax(0,1fr)_320px]">
        <section aria-labelledby="books-title" className="min-h-0 rounded-md border border-border bg-card">
          <h2 id="books-title" className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Libros
          </h2>
          <ul className="max-h-[60vh] overflow-y-auto p-1">
            {books.map((item) => (
              <li key={item.usfm}>
                <button
                  type="button"
                  onClick={() => setBookUsfm(item.usfm)}
                  aria-current={item.usfm === bookUsfm}
                  className={cn(
                    "w-full truncate rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                    item.usfm === bookUsfm ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="chapters-title" className="min-h-0 rounded-md border border-border bg-card">
          <h2 id="chapters-title" className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Capítulos
          </h2>
          <ul className="grid max-h-[60vh] grid-cols-3 gap-1 overflow-y-auto p-2">
            {(book?.chapterNumbers ?? []).map((number) => (
              <li key={number}>
                <button
                  type="button"
                  onClick={() => book && void openChapter(book.usfm, number)}
                  aria-current={chapter?.number === number}
                  className={cn(
                    "w-full rounded-sm px-1 py-1 text-center font-mono text-xs hover:bg-muted",
                    chapter?.number === number ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {number}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="verses-title" className="min-w-0 rounded-md border border-border bg-card">
          <h2 id="verses-title" className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {book ? `${book.name} ${chapter?.number ?? ""}` : "Versículos"}
          </h2>
          <ul className="max-h-[60vh] overflow-y-auto p-2">
            {(chapter?.verses ?? []).map((verse) => {
              const selected = selection.includes(verse.number);
              return (
                <li key={verse.number}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={(event) => handleVerseClick(verse.number, event.shiftKey)}
                    className={cn(
                      "flex w-full gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      selected ? "bg-primary/10 ring-1 ring-primary" : "",
                    )}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {verse.number}
                    </span>
                    <span className="min-w-0 flex-1 text-foreground">
                      {verse.lines.map((line, index) => (
                        <span key={`${index}-${line}`} className="block">{line}</span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <BiblePassagePanel
          passage={passage}
          projects={projects}
          defaultProjectId={activeProjectId}
          onAdd={(projectId, value) => addPassageToProject(projectId, value)}
        />
      </div>
    </Page>
  );
}
