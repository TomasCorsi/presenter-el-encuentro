import { useEffect, useMemo, useState, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { BibleBookMeta, BiblePassage } from "@/domain/bible/bible";
import {
  buildPassage,
  classifyReferenceInput,
  parseBibleReference,
} from "@/domain/bible/bible-reference";
import { useBible } from "@/features/bible/bible-context";
import { resolveBibleVersionSelection } from "@/features/bible/bible-version-selection";

import { LibraryResultRow } from "./library-result-row";

export interface LibraryBibleTabProps {
  inputRef: RefObject<HTMLInputElement | null>;
  canAdd: boolean;
  busy: boolean;
  /** Última traducción elegida en este puesto de trabajo. */
  versionId: string | null;
  onVersionChange(versionId: string): void;
  onAdd(passage: BiblePassage, mode: "rundown" | "live"): void;
}

const HINT = "Escribe una referencia, por ejemplo Juan 3:16.";

/**
 * Búsqueda por referencia dentro de Live. Usa exactamente la misma fuente de
 * verdad que `/bible`: el BibleContext, sus traducciones instaladas y el
 * parser de referencias. Live nunca toca IndexedDB directamente.
 */
export function LibraryBibleTab({
  inputRef,
  canAdd,
  busy,
  versionId,
  onVersionChange,
  onAdd,
}: LibraryBibleTabProps) {
  const { versions, hasLoaded, getBooks, getChapter } = useBible();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [booksError, setBooksError] = useState(false);
  const [passage, setPassage] = useState<BiblePassage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Selección efectiva: auto con una sola, última elegida con varias y
  // fallback a la primera cuando la guardada ya no está instalada.
  const selection = useMemo(
    () => resolveBibleVersionSelection(versions, versionId),
    [versionId, versions],
  );
  const version = useMemo(
    () => versions.find((candidate) => candidate.id === selection.versionId) ?? null,
    [selection.versionId, versions],
  );

  useEffect(() => {
    if (selection.changed && selection.versionId) onVersionChange(selection.versionId);
  }, [onVersionChange, selection.changed, selection.versionId]);

  useEffect(() => {
    let cancelled = false;
    setBooksError(false);
    if (!version) {
      setBooks([]);
      return;
    }
    void getBooks(version.id)
      .then((loaded) => {
        if (!cancelled) setBooks(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setBooks([]);
        setBooksError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [getBooks, version]);

  useEffect(() => {
    let cancelled = false;
    setPassage(null);

    if (!version || books.length === 0) {
      setMessage(null);
      return;
    }

    // Mientras la referencia está incompleta no se muestra ningún error.
    const inputState = classifyReferenceInput(query, books);
    if (inputState === "empty" || inputState === "incomplete") {
      setMessage(null);
      return;
    }

    const reference = inputState === "valid" ? parseBibleReference(query, books) : null;
    if (!reference) {
      setMessage("No se reconoce esa referencia. Ejemplo: Juan 3:16-18.");
      return;
    }

    setMessage(null);
    void getChapter(version.id, reference.bookUsfm, reference.chapter)
      .then((chapter) => {
        if (cancelled) return;
        const book = books.find((candidate) => candidate.usfm === reference.bookUsfm);
        if (!chapter || !book) {
          setMessage("Ese capítulo no está disponible en esta traducción.");
          return;
        }

        const numbers = reference.from
          ? chapter.verses
              .map((verse) => verse.number)
              .filter((number) => inRange(number, reference.from, reference.to))
          : [];

        const built = buildPassage({ version, book, chapter, verseNumbers: numbers });
        if (!built) setMessage("El rango no contiene versículos.");
        setPassage(built);
      })
      .catch(() => {
        if (!cancelled) setMessage("No se pudo leer el texto de esta traducción.");
      });

    return () => {
      cancelled = true;
    };
  }, [books, getChapter, query, version]);

  if (versions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-1 py-2">
        <p className="text-sm text-foreground">
          {hasLoaded ? "No hay Biblias instaladas" : "Cargando Biblias instaladas…"}
        </p>
        {hasLoaded ? (
          <p className="text-xs text-muted-foreground">Importa una desde la sección Bible.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Referencia: Juan 3:16-18"
          aria-label="Buscar referencia bíblica"
          className="h-8"
        />
        <Select value={version?.id ?? ""} onValueChange={onVersionChange}>
          <SelectTrigger aria-label="Traducción" className="h-8 w-36 shrink-0">
            <SelectValue placeholder="Traducción" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.abbreviation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {booksError ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No se pudo leer esta traducción. Prueba con otra o vuelve a importarla.
          </p>
        ) : passage ? (
          <ul className="flex flex-col gap-1.5" aria-label="Pasaje encontrado">
            <LibraryResultRow
              title={passage.reference}
              subtitle={`${passage.versionAbbreviation} · ${passage.verses.length} versículos`}
              disabled={!canAdd}
              busy={busy}
              onAdd={() => onAdd(passage, "rundown")}
              onGoLive={() => onAdd(passage, "live")}
            />
          </ul>
        ) : (
          <p className="px-1 py-2 text-sm text-muted-foreground">{message ?? HINT}</p>
        )}
      </div>
    </div>
  );
}

/** ¿El número de versículo entra en el rango pedido? Acepta "3-4". */
function inRange(number: string, from: string | undefined, to: string | undefined): boolean {
  if (!from) return true;
  const value = Number.parseInt(/\d+/.exec(number)?.[0] ?? "", 10);
  if (!Number.isFinite(value)) return false;
  const start = Number.parseInt(from, 10);
  const end = to ? Number.parseInt(to, 10) : start;
  return value >= start && value <= end;
}
