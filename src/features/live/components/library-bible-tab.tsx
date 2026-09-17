import { useEffect, useMemo, useState, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { BibleBookMeta, BiblePassage } from "@/domain/bible/bible";
import { buildPassage, parseBibleReference } from "@/domain/bible/bible-reference";
import { useBible } from "@/features/bible/bible-context";

import { LibraryResultRow } from "./library-result-row";

export interface LibraryBibleTabProps {
  inputRef: RefObject<HTMLInputElement | null>;
  canAdd: boolean;
  busy: boolean;
  versionId: string | null;
  onVersionChange(versionId: string): void;
  onAdd(passage: BiblePassage, mode: "rundown" | "live"): void;
}

/**
 * Búsqueda por referencia dentro de Live. Reutiliza las Biblias instaladas, el
 * parser de referencias y el servicio de Bible: Live no toca IndexedDB.
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
  const [passage, setPassage] = useState<BiblePassage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const version = useMemo(
    () => versions.find((candidate) => candidate.id === versionId) ?? versions[0] ?? null,
    [versionId, versions],
  );

  useEffect(() => {
    let cancelled = false;
    if (!version) {
      setBooks([]);
      return;
    }
    void getBooks(version.id).then((loaded) => {
      if (!cancelled) setBooks(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [getBooks, version]);

  useEffect(() => {
    let cancelled = false;
    setPassage(null);

    if (!version || !query.trim()) {
      setMessage(null);
      return;
    }

    const reference = parseBibleReference(query, books);
    if (!reference) {
      setMessage("No se reconoce la referencia. Ejemplo: Juan 3:16-18.");
      return;
    }

    setMessage(null);
    void getChapter(version.id, reference.bookUsfm, reference.chapter).then((chapter) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [books, getChapter, query, version]);

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
          disabled={versions.length === 0}
        />
        <Select
          value={version?.id ?? ""}
          onValueChange={onVersionChange}
          disabled={versions.length === 0}
        >
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
        {versions.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            {hasLoaded
              ? "No hay Biblias instaladas. Importa una desde la sección Bible."
              : "Cargando Biblias instaladas…"}
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
          <p className="px-1 py-2 text-sm text-muted-foreground">
            {message ?? "Escribe una referencia para buscar el pasaje."}
          </p>
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
