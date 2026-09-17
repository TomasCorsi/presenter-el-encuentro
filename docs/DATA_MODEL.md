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
  itemIds: string[]
  createdAt: string
  updatedAt: string
}
```

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
  tags: string[]
  sectionIds: string[]
  presetId?: string
  favorite: boolean
  createdAt: string
  updatedAt: string
}
```

## Song Section

```ts
type SongSectionType =
  | "verse"
  | "chorus"
  | "bridge"
  | "ending"
  | "intro"
  | "custom"

interface SongSection {
  id: string
  songId: string
  type: SongSectionType
  label: string
  order: number
  text: string
}
```

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
