# Data Model

## Workspace

```ts
interface Workspace {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}
```

## Project

```ts
interface Project {
  id: string
  workspaceId: string
  name: string
  eventDate?: string
  rundown: RundownItem[]
  createdAt: string
  updatedAt: string
}
```

### Rundown (Fase 5)

El rundown vive embebido en el Project (ADR-018); `itemIds` fue eliminado.

```ts
type RundownItemType =
  | "song" | "bible" | "media" | "presentation" | "countdown" | "message"

interface RundownItem {
  id: string        // identidad de instancia dentro de este rundown
  type: RundownItemType
  sourceId: string  // identidad de origen, p. ej. song.id
  title: string     // snapshot para referencias rotas
  order: number     // normalizado siempre a 0..n-1
}
```

Solo `type: "song"` es funcional en la Fase 5; los demás quedan declarados.
`id` ≠ `sourceId` permite repetir la misma canción varias veces (A, B, A).
Si la fuente ya no existe, el item se conserva y se muestra como contenido
faltante (ADR-020).

### Persistencia

Clave `broadcast-control.projects.v2`. Si solo existe
`broadcast-control.projects.v1`, se migra añadiendo `rundown: []` y
descartando `itemIds`; la clave v1 se conserva como respaldo (ADR-019). La
capacidad de localStorage es limitada y depende del navegador y del entorno:
un error de cuota es un error real y se propaga. IndexedDB sigue diferido a la
Fase 11.


### Proyecto activo

`activeProjectId: string | null` no es un campo de `Project`. En la Fase 2 es
estado local del workspace/dispositivo, persistido temporalmente en el navegador.
No forma parte del modelo sincronizado. Una fase futura decidirá si permanece por
dispositivo o si debe sincronizarse.

## Presentation Item

```ts
type PresentationItemType =
  | "song"
  | "bible"
  | "media"
  | "presentation"
  | "countdown"
  | "message"

interface PresentationItem {
  id: string
  projectId: string
  type: PresentationItemType
  title: string
  order: number
  slideIds: string[]
  presetId?: string
}
```

## Slide

```ts
interface Slide {
  id: string
  itemId: string
  order: number
  content: SlideContent
  notes?: string
}
```

## Song

```ts
interface Song {
  id: string
  workspaceId: string
  title: string
  author?: string
  sections: SongSection[] // embebidas, ordenadas por `order`
  createdAt: string
  updatedAt: string
}
```

Campos diferidos a fases posteriores (ADR-012): `tags`, `favorite`,
`presetId` y cualquier metadata de copyright.

## Song Section

```ts
type SongSectionType =
  | "verse"
  | "chorus"
  | "prechorus"
  | "bridge"
  | "intro"
  | "outro"
  | "custom"

interface SongSection {
  id: string
  type: SongSectionType
  label: string
  content: string
  order: number // normalizado a 0..n-1
}
```

Las secciones viven embebidas en `Song` (sin tabla/colección separada ni
`songId`): son una unidad de persistencia en la fase local. Los labels
automáticos (Verso N, Coro, Pre-coro, Puente, Intro, Outro) se generan al
crear la sección y nunca sobrescriben un label personalizado.

## Preset

```ts
interface Preset {
  id: string
  workspaceId: string
  name: string
  category: "worship" | "bible" | "sermon" | "youth" | "conference" | "lower-third" | "custom"
  mainLayout: OutputLayout
  stageLayout?: OutputLayout
  streamLayout?: OutputLayout
}
```

## Media Asset

```ts
interface MediaAsset {
  id: string
  workspaceId: string
  name: string
  type: "image" | "video" | "audio" | "logo"
  mimeType: string
  size: number
  width?: number
  height?: number
  duration?: number
  cloudUrl?: string
  localKey?: string
  offlineReady: boolean
}
```

## Output

```ts
type OutputType = "main" | "stage" | "stream"

interface OutputConfig {
  id: string
  workspaceId: string
  type: OutputType
  name: string
  width: number
  height: number
  enabled: boolean
}
```

## Sync Metadata

```ts
interface SyncMetadata {
  entityType: string
  entityId: string
  localUpdatedAt: string
  cloudUpdatedAt?: string
  syncStatus: "synced" | "pending" | "conflict" | "error"
}
```

## Nota

El modelo debe evolucionar por migraciones controladas. Evitar agregar campos innecesarios antes de que una fase los requiera.

---

## Modelo de runtime del Presentation Engine (Fase 4)

El motor no consume el modelo persistido tal cual: recibe una presentación ya
resuelta, con las slides embebidas en cada item en lugar de `slideIds`. Las
slides no se persisten en esta fase; se derivan de la Song.

```ts
interface Slide {
  id: string          // `${itemId}:${sectionId}:${chunkIndex}`
  itemId: string
  order: number       // 0..n-1 dentro del item
  content: { kind: "text"; lines: string[] }
  label?: string
  sourceSectionId?: string
}

interface PresentationItem {
  id: string          // identidad de ESTA instancia en la presentación
  type: PresentationItemType
  title: string
  order: number
  slides: Slide[]
  sourceId?: string   // identidad de la entidad original (song.id)
}
```

Identidad de instancia vs. identidad de origen: una misma Song puede aparecer
varias veces en un rundown (A, B, A). `item.id` distingue cada aparición y
`sourceId` apunta a la canción original.

### Estado y runtime derivado

```ts
interface PresentationRuntime {
  items: readonly PresentationItem[]
  itemIndexById: ReadonlyMap<string, number>
  slideLocationById: ReadonlyMap<string, SlideLocation>
  navigableSlideIds: readonly string[]
}

type ProgramMode = "content" | "clear" | "black"

interface PresentationState {
  runtime: PresentationRuntime
  previewItemId: string | null
  previewSlideId: string | null
  programSlideId: string | null   // el item de Program se deriva del runtime
  programMode: ProgramMode
}
```

El runtime son datos derivados e inmutables, construidos solo cuando cambia la
presentación. El estado operativo del motor NO se persiste (ni localStorage, ni
IndexedDB, ni nube).

Desde la Fase 6 la posición está separada: la navegación mueve Preview y solo
TAKE escribe en Program. `clear` y `black` son modos temporales de salida y
nunca borran `programSlideId`, así que volver a `content` devuelve al aire la
misma slide. `loadPresentation` descarta Program; `reloadPresentation` lo
conserva mientras su id siga existiendo.


## Output Sync (Fase 7)

`OutputSnapshot` es el único estado que viaja de Live a `/output/main`:

```ts
interface OutputSnapshot {
  sessionId: string;        // efímero, generado al montar Live
  sequence: number;         // incremental por sesión
  mode: ProgramMode;        // content | clear | black
  slide: { id: string; lines: string[]; style: PresetStyle } | null;
}
```

Transmite el contenido RESUELTO de Program: Output nunca reconstruye nada
desde Projects/Songs. Preview no se sincroniza. No hay persistencia: el
protocolo vive solo en memoria y en el canal de broadcast.


## Preset (Fase 8)

```ts
interface Preset {
  id: string;
  workspaceId: string;
  name: string;
  style: PresetStyle;
  createdAt: string;
  updatedAt: string;
}

interface PresetStyle {
  fontFamily: "sans" | "serif" | "mono";  // stacks locales, sin CDN
  fontSize: number;                        // % de la ALTURA del lienzo → cqh
  fontWeight: 400 | 600 | 700;
  lineHeight: number;                      // 1.0 .. 2.0
  align: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
  textColor: string;                       // dato del usuario, no token de UI
  background: { type: "solid"; color: string };  // discriminado: solo solid
  safeAreaX: number;                       // % del ancho → cqw
  safeAreaY: number;                       // % de la altura → cqh
}
```

El Preset define APARIENCIA; Song y Slide definen CONTENIDO. Ningún estilo se
guarda dentro del texto de una Song.

`RundownItem` gana `presetId?: string`. Al estar en la aparición y no en la
Song, la misma canción puede verse distinta en dos momentos del show. Un
`presetId` ausente o inexistente resuelve al Default (`preset-default`), que
se sintetiza en memoria y nunca se persiste.

Persistencia temporal en `localStorage` bajo `broadcast-control.presets.v1`;
un estilo corrupto se normaliza campo a campo en lugar de perder el preset.

## Fase 9 — Bible

Modelo canónico (independiente del archivo importado):

```ts
interface BibleVersionMeta {
  id: string; abbreviation: string; title: string;
  language: string; publisher?: string; copyright?: string;
  bookCount: number; installedAt: string;
}
interface BibleBookMeta { usfm: string; name: string; chapters: number[] }
interface BibleVerse { number: string; lines: string[] }   // multilínea real
interface BibleChapter { versionId: string; bookUsfm: string; chapter: number; verses: BibleVerse[] }
interface CanonicalBible { version: BibleVersionMeta; books: BibleBookMeta[]; chapters: BibleChapter[] }
```

Pasaje congelado que viaja al Rundown:

```ts
interface BiblePassage {
  versionId: string; versionAbbreviation: string;
  bookUsfm: string; bookName: string; chapter: number;
  reference: string;            // "Juan 3:2-4"
  verses: BibleVerse[];         // texto completo, copiado
}
```

`RundownItem` gana `payload?: { kind: "bible"; passage: BiblePassage }` y
`Slide` gana `secondaryText?: string`. El item Bible es autosuficiente: no
depende de la traducción instalada (ADR-042).

Persistencia de Biblias: IndexedDB `broadcast-control.bible` (v1), stores
`versions` (key `id`), `books` (key `versionId`) y `chapters`
(key `${versionId}|${bookUsfm}|${chapter}`, índice `versionId`). Reinstalar
una versión reemplaza sus datos sin dejar huérfanos.
