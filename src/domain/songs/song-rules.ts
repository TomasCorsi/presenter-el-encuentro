import {
  LOCAL_WORKSPACE_ID,
  SONG_TITLE_MAX_LENGTH,
  type CreateSongInput,
  type Song,
  type SongFactoryDependencies,
  type SongSection,
  type SongSectionType,
} from "./song";

export class SongTitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SongTitleError";
  }
}

const BASE_SECTION_LABELS: Record<Exclude<SongSectionType, "verse" | "custom">, string> = {
  chorus: "Coro",
  prechorus: "Pre-coro",
  bridge: "Puente",
  intro: "Intro",
  outro: "Outro",
};

export function normalizeSongTitle(value: string): string {
  const title = value.trim();

  if (!title) throw new SongTitleError("El título de la canción es obligatorio.");
  if (title.length > SONG_TITLE_MAX_LENGTH) {
    throw new SongTitleError(`El título no puede superar ${SONG_TITLE_MAX_LENGTH} caracteres.`);
  }

  return title;
}

export function normalizeSongAuthor(value: string | undefined): string | undefined {
  const author = value?.trim();
  return author ? author : undefined;
}

/**
 * Label inicial razonable para una sección nueva.
 * Los versos se numeran según la cantidad de versos existentes.
 */
export function defaultSectionLabel(type: SongSectionType, sections: SongSection[]): string {
  if (type === "verse") {
    const verseCount = sections.filter((section) => section.type === "verse").length;
    return `Verso ${verseCount + 1}`;
  }
  if (type === "custom") return "Sección";
  return BASE_SECTION_LABELS[type];
}

/** Label por defecto de un tipo, sin contexto de lista (para respaldos). */
export function fallbackSectionLabel(type: SongSectionType): string {
  if (type === "verse") return "Verso 1";
  if (type === "custom") return "Sección";
  return BASE_SECTION_LABELS[type];
}

/** Normaliza exclusivamente `order` a 0..n-1; nunca toca labels. */
export function normalizeSectionOrder(sections: SongSection[]): SongSection[] {
  return sections.map((section, index) => ({ ...section, order: index }));
}

export function createSong(input: CreateSongInput, dependencies: SongFactoryDependencies): Song {
  const timestamp = dependencies.now();

  return {
    id: dependencies.createId(),
    workspaceId: input.workspaceId ?? LOCAL_WORKSPACE_ID,
    title: normalizeSongTitle(input.title),
    author: normalizeSongAuthor(input.author),
    sections: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function renameSong(song: Song, title: string, now: () => string): Song {
  return { ...song, title: normalizeSongTitle(title), updatedAt: now() };
}

export function updateSongAuthor(song: Song, author: string | undefined, now: () => string): Song {
  return { ...song, author: normalizeSongAuthor(author), updatedAt: now() };
}

/**
 * Duplicación como regla de negocio: nueva canción independiente, con nuevos
 * IDs en cada sección y sin referencias mutables compartidas.
 */
export function duplicateSong(song: Song, dependencies: SongFactoryDependencies): Song {
  const timestamp = dependencies.now();
  const suffix = " — copia";
  const copiedTitle = `${song.title.slice(0, SONG_TITLE_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;

  return {
    ...song,
    id: dependencies.createId(),
    title: normalizeSongTitle(copiedTitle),
    sections: song.sections.map((section) => ({ ...section, id: dependencies.createId() })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function addSection(
  song: Song,
  type: SongSectionType,
  dependencies: SongFactoryDependencies,
): Song {
  const section: SongSection = {
    id: dependencies.createId(),
    type,
    label: defaultSectionLabel(type, song.sections),
    content: "",
    order: song.sections.length,
  };
  return { ...song, sections: [...song.sections, section], updatedAt: dependencies.now() };
}

export interface UpdateSectionInput {
  type?: SongSectionType;
  label?: string;
  content?: string;
}

/**
 * Edita una sección. Un label vacío repone el label por defecto del tipo
 * (nunca bloquea el guardado). Cambiar el tipo solo sugiere un nuevo label
 * cuando el anterior todavía era un label generado automáticamente.
 */
export function updateSection(
  song: Song,
  sectionId: string,
  input: UpdateSectionInput,
  now: () => string,
): Song {
  const sections = song.sections.map((section) => {
    if (section.id !== sectionId) return section;

    const nextType = input.type ?? section.type;
    let nextLabel = input.label ?? section.label;

    if (input.type && input.type !== section.type) {
      const wasAutoLabel = section.label === defaultLabelForTypeAt(section.type, section, song.sections)
        || section.label === fallbackSectionLabel(section.type);
      if (wasAutoLabel) {
        nextLabel = defaultSectionLabel(nextType, song.sections.filter((item) => item.id !== sectionId));
      }
    }

    if (!nextLabel.trim()) nextLabel = fallbackSectionLabel(nextType);

    return {
      ...section,
      type: nextType,
      label: nextLabel,
      content: input.content ?? section.content,
    };
  });

  return { ...song, sections, updatedAt: now() };
}

function defaultLabelForTypeAt(type: SongSectionType, section: SongSection, sections: SongSection[]): string {
  if (type !== "verse") return fallbackSectionLabel(type);
  const versesBefore = sections.filter(
    (item) => item.type === "verse" && item.order < section.order,
  ).length;
  return `Verso ${versesBefore + 1}`;
}

export function removeSection(song: Song, sectionId: string, now: () => string): Song {
  return {
    ...song,
    sections: normalizeSectionOrder(song.sections.filter((section) => section.id !== sectionId)),
    updatedAt: now(),
  };
}

/** Mueve una sección: solo cambia `order`, nunca labels. */
export function moveSection(
  song: Song,
  sectionId: string,
  direction: "up" | "down",
  now: () => string,
): Song {
  const index = song.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return song;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= song.sections.length) return song;

  const sections = [...song.sections];
  const [moved] = sections.splice(index, 1);
  if (!moved) return song;
  sections.splice(target, 0, moved);

  return { ...song, sections: normalizeSectionOrder(sections), updatedAt: now() };
}

export function filterSongs(songs: Song[], query: string): Song[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...songs];
  return songs.filter((song) =>
    song.title.toLocaleLowerCase().includes(normalizedQuery)
    || (song.author ?? "").toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function sortSongsByUpdatedAt(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
