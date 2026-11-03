# Architecture

## Objetivo

Construir una arquitectura local-first, modular, escalable y preparada para múltiples outputs.

## Vista general

```text
UI
│
├── Features
│   ├── Projects
│   ├── Songs
│   ├── Bible
│   ├── Media
│   ├── Presets
│   ├── Presentation
│   ├── Outputs
│   └── Remote
│
├── Domain / Services
│
├── State
│
├── Local Persistence
│   └── IndexedDB
│
└── Sync Engine
    └── Supabase
```

## Separación de responsabilidades

### UI

Solo representa estado y dispara acciones.

### Domain

Contiene reglas del negocio.

### State

Mantiene el estado interactivo y de presentación.

### Persistence

Guarda contenido localmente.

### Sync

Sincroniza con la nube sin bloquear Live.

### Presentation Engine

Motor desacoplado del UI.

### Outputs

Renderizan el mismo estado con diferentes layouts.

## Presentation Engine

Estado conceptual:

```ts
type PresentationState = {
  previewItemId: string | null
  previewSlideId: string | null
  programSlideId: string | null
  programMode: "content" | "clear" | "black"
  detachedProgramSlide: Slide | null
  runtime: PresentationRuntime
}
```

Acciones principales:

```text
nextLive()
previousLive()
selectSlide()
take()
clear()
black()
```

## Outputs

Rutas previstas:

```text
/output/main
/output/stage
/output/stream
```

Cada output debe:

- Leer el estado de presentación.
- Aplicar su layout.
- No contener controles.
- Renderizar de forma eficiente.

## Estrategia Cloud

Supabase se utilizará para:

- Auth.
- Workspaces.
- Proyectos.
- Canciones.
- Presets.
- Configuración.
- Storage.
- Backups.
- Sincronización.

## Estrategia Local

- IndexedDB `broadcast-control.app`: Projects, Songs, Presets y metadata local
  como `activeProjectId` y marcadores de migración.
- IndexedDB `broadcast-control.bible`: traducciones, libros y capítulos.
- IndexedDB `broadcast-control.media`: metadata y colecciones Media.
- OPFS: bytes Media; IndexedDB Blob permanece como fallback sólo para imágenes.
- `localStorage`: preferencias del dispositivo. Las claves legacy de Projects,
  Songs y Presets se conservan read-only como respaldo de migración.
- Memoria: sesión de Live, estado Output y relay Stream.

No existen todavía cola de sincronización, conflictos, cloud storage ni backup.

## Regla crítica

La presentación debe seguir funcionando aunque:

```text
Internet = OFF
```

## Performance

Evitar operaciones pesadas en el thread principal durante Live.

Priorizar:

- Precarga de siguiente slide.
- Memoización selectiva.
- Lazy loading.
- Code splitting.
- Virtualización de listas grandes.
- Procesamiento de medios fuera del flujo crítico.

---

## Estructura real del proyecto (definida en Fase 0)

El stack actual de Lovable es TanStack Start con enrutado por archivos. No se usa
`src/app/` ni `src/pages/`.

```text
docs/                     documentación: fuente de verdad
src/
├── routes/               enrutado por archivos (app, /output/*, /remote)
├── components/ui/        componentes base reutilizables
├── components/layout/    shell: sidebar, topbar (Fase 1)
├── features/             projects, songs, bible, media, presets,
│                         presentation, outputs, remote
├── domain/               tipos y reglas de negocio puras
├── services/             repositorios y acceso a datos
├── stores/               estado interactivo (desde Fase 4)
├── lib/                  utilidades
└── styles.css            tokens del design system
```

Las carpetas se crean cuando la fase que las necesita comienza. No se crean
carpetas vacías.

### Regla de dependencias

```text
routes → features → domain
features → services → persistence
```

Nunca al revés. Un componente jamás accede a IndexedDB ni a la nube directamente.

### Persistencia de aplicación desde Fase 12

El flujo actual es:

```text
UI → Providers / Services → Repository async → broadcast-control.app (IndexedDB)
```

Un bootstrap único abre y migra la base antes de entregar los repositorios a
Projects, Songs y Presets. Cada migración escribe entidades y marcador en una
misma transacción. Un payload corrupto nunca se convierte en colección vacía ni
se sobrescribe. Ante un fallo, el dominio usa una fuente legacy coherente durante
esa sesión o queda explícitamente degradado si el payload no es seguro.

`activeProjectId` vive en el store `meta`; borrar el proyecto activo limpia esa
referencia dentro de la misma transacción. Bible y Media permanecen en sus DBs
independientes, y los bytes Media no salen de OPFS.

El bootstrap ocurre después del montaje en cliente. SSR nunca accede a
IndexedDB, `localStorage`, StorageManager ni al Service Worker.

### Convención de rutas de outputs

| URL              | Archivo                          |
| ---------------- | -------------------------------- |
| `/output/main`   | `src/routes/output.main.tsx`     |
| `/output/stage`  | `src/routes/output.stage.tsx`    |
| `/output/stream` | `src/routes/output.stream.tsx`   |
| `/remote`        | `src/routes/remote.tsx`          |

Los outputs no contienen controles y no comparten layout con la aplicación.

## SSR: código exclusivo de cliente

La aplicación se renderiza también en el servidor. El siguiente código NO puede
ejecutarse durante la importación de un módulo ni durante el render:

- `window`, `document`, `navigator`, `location`.
- `localStorage`, `sessionStorage`, IndexedDB.
- `BroadcastChannel`.
- Registro del Service Worker.
- Apertura de ventanas de output (`window.open`).
- `matchMedia`, tamaños de pantalla, fullscreen API.

Dónde sí se permite: dentro de `useEffect`, en manejadores de eventos, dentro de
`<ClientOnly>`, o detrás de `useHydrated() === true`. Las librerías que tocan el
navegador al importarse se cargan con `import()` dinámico o `React.lazy`.

Los secretos y variables de entorno sin prefijo `VITE_` solo se leen dentro del
handler de una server function.

## Backend

No hay backend conectado. Supabase/Auth pertenecen a la Fase 13; ningún módulo
de Fase 12 asume su existencia.

## Presentation Engine en Fase 4

Implementación real de ADR-004:

```text
Song → songToPresentationItem() → PresentationItem (slides embebidas)
     → buildPresentationRuntime() → PresentationRuntime (índices derivados)
     → comandos puros → PresentationState
     → presentation store (vanilla) → React (useSyncExternalStore)
```

Ubicación:

```text
src/domain/presentation/     tipos, runtime, comandos, selectores, Song → Item
src/stores/                  presentation-store.ts (vanilla, sin React)
src/features/presentation/   provider y hooks de React
```

El dominio no importa React, DOM ni APIs del navegador, así que puede
ejecutarse en servidor, en tests y en futuras ventanas de output. El store
permite suscripciones dentro de un mismo runtime JS; no sincroniza ventanas
distintas. Live, Outputs, Stage, Stream y Remote consumirán este motor en lugar
de reimplementar su lógica.

## Composición del Project en Fase 5

El rundown conecta Projects, Songs y Presentation Engine sin acoplar features:

```text
Project.rundown + Song[] → projectToPresentation() → PresentationItem[]
                                                   → buildPresentationRuntime()
```

`projectToPresentation` es una función pura de `src/domain/presentation/` que
reutiliza `songToPresentationItem`. Desde la Fase 6, `/live` consume esa
conversión mediante `buildLiveSnapshot`: compone el show UNA vez y opera
siempre sobre ese snapshot. Editar el rundown o una canción no altera el show
en curso; Live avisa del desfase y el operador decide recargar (ADR-023).
La navegación mueve Preview y solo TAKE cambia de item en Program (ADR-022,
ADR-025). Desde la Fase 8.1, Next/Previous arrastran también Program cuando
Preview y Program están en el MISMO item y el salto no cruza su borde: la
regla vive en `presentation-live.ts` (`nextLive` / `previousLive`), por encima
de un engine que sigue siendo navegación pura de Preview (ADR-037).

### Límite entre features

`features/songs` no importa lógica, contextos ni servicios de
`features/projects`, ni al revés. Cuando una pantalla necesita ambos, la
composición ocurre en la ruta:

```text
Route → useSongs() + useProjects()
      → findSongUsage() (función pura de dominio)
      → props hacia los componentes de Songs
```

Así no hay ciclos entre features y las reglas de uso quedan testeables sin
React ni persistencia.

## Output Sync (Fase 7)

```text
Live Store
  ↓ (useOutputPublisher, suscrito al store)
OutputPublisher — compara mode + slide.id + slide.lines
  ↓ OutputTransport (BroadcastChannel `broadcast-control.output.v1`)
OutputSubscriber — vinculación de sesión, sequence, heartbeat 2 s / timeout 5 s
  ├→ /output/main — superficie segura fuera del App Shell, solo representa Program
  └→ /output/stage — superficie read-only con current/next, reloj y estado de conexión
```

Flujo unidireccional: Live es la única autoridad; Output nunca envía
comandos. El transporte es una interfaz (`OutputTransport`) con
implementación BroadcastChannel en el navegador y en memoria para tests;
los componentes React no acceden al canal. Sin sesión válida la superficie
es negro puro (ADR-030).

Desde Fase 11.1, el snapshot conserva el `ProgramOutput` existente y agrega de
forma opcional `stage?: StageProjection`. `buildStageProjection` deriva current
desde Program y next desde `runtime.navigableSlideIds`; Preview no participa.
Main ignora esa proyección. Stage conserva el último snapshot visible durante
stale, pero no publica mensajes operativos ni consulta storage para reconstruir
Song/Bible. Para Media solo consume metadata y thumbnail estático del provider.

### Stream Output transparente (Fase 11.2)

```text
Live / useOutputPublisher
  ├─ BroadcastChannel ─────────────── Main + Stage
  └─ HTTP POST /api/output-relay
                  │
                  └─ SSE ──────────── /output/stream en OBS/vMix
```

El transporte compuesto replica el mismo `OutputMessage`; no existe una
proyección Stream ni una versión nueva del protocolo. El hub vive sólo en la
memoria de un servidor loopback de proceso único, excluye al emisor y no guarda
historial. `hello`, heartbeat, session y sequence siguen perteneciendo al
publisher/subscriber existentes.

`/output/stream` está fuera del App Shell y no monta `MediaProvider`, fondos,
Media ni fullscreen chrome. Sólo una slide textual en modo Content produce DOM;
Clear, Black, Media, stale o falta de sesión producen un canvas transparente.
OBS debe usar Browser Source y vMix Web Browser Input. Window Capture no es un
camino de alpha soportado.

## Providers del App Shell (Fase 7.1)

```text
_app.tsx
  ProjectsProvider   ← se monta una sola vez
    SongsProvider    ← se monta una sola vez
      SidebarProvider → AppShell → <Outlet /> (rutas)
```

Los layouts intermedios (`_app.projects.tsx`, `_app.songs.tsx`,
`_app.live.tsx`) solo renderizan `<Outlet />` (o `PresentationProvider` en
Live). Ningún layout hijo vuelve a montar un provider de datos: montarlos por
ruta provocaba desmontaje, relectura de `localStorage` y un placeholder
"Cargando…" en cada navegación.

Cada estado de datos distingue tres campos: `loading` (operación en curso),
`hasLoaded` (la carga inicial terminó, con éxito o error) y `error`. Las
vistas bloquean solo mientras `hasLoaded` es `false`; refrescos posteriores no
sustituyen la pantalla.


## Presets y renderizado (Fase 8)

Composición de contenido y resolución de estilo son pasos distintos:

```text
Project + Songs
  → projectToPresentation()        contenido + presetId (NO conoce Presets)
Presets
  → buildLiveSnapshot()            resuelve y CONGELA el estilo por aparición
  → Presentation Engine            transporta contenido + estilo ya resuelto
  → OutputPublisher                OutputSnapshot con estilo resuelto
  → /output/main
```

`projectToPresentation` nunca importa Presets; el Presentation Engine no los
consulta ni interpreta. La única frontera de resolución es el snapshot de
Live, por eso editar un Preset con Live abierto NO cambia Program: aparece el
aviso de contenido desactualizado y el operador decide recargar.

El cálculo visual vive en la función pura
`resolveSlideRenderStyle(PresetStyle) → ResolvedSlideRenderStyle`, consumida
por el componente único `SlideRenderer`. Live Preview, Live Program,
`/output/main` y la vista previa del editor renderizan con ese mismo
componente, así que no pueden divergir. El tamaño y la safe area se expresan
en `cqh`/`cqw` sobre un contenedor 16:9, de modo que la misma configuración se
ve proporcionalmente igual en un monitor pequeño y en 1920×1080.

`clear` y `black` siguen siendo modos de salida independientes del Preset:
`black` es negro puro y `clear` usa el fondo base opaco.

## Fase 9 — Cadena de Bible

```
Archivo Bible .json
  → BibleImportAdapter          formato externo → CanonicalBible
  → BibleRepository (IndexedDB) instalación local, offline
  → UI /bible                   navegar libro/capítulo/versículo, rango
  → BiblePassage                snapshot con texto completo
  → RundownItem.payload         congelado en el Project
  → projectToPresentation       un versículo = una slide
  → Live → OutputSnapshot → /output/main
```

Bible no conoce Live ni Output. Live nunca consulta IndexedDB. Output no
conoce Bible: recibe slides con `lines`, `secondaryText` y estilo resuelto.
`BibleService` y `BibleProvider` viven en `src/features/bible`; el repositorio
IndexedDB se instancia solo en cliente, después del montaje.

## Fase 10 — Cadena de Media

`src/domain/media/` (tipos y reglas puras) → `src/services/media/` (repositorio, storages, caché de URLs por ventana, persistencia) → `src/features/media/media-service.ts` (coordinador) → `media-context.tsx` (`MediaProvider`, `useMedia`, `useMediaUrl`) montado en `_app.tsx` y `output.main.tsx`. `SlideContent` es unión discriminada `text | image | video`; `MediaSlideSurface` renderiza image/video en Live y Output. La firma de presentación usa exclusivamente `presentationUpdatedAt`; colección, tags, favoritos y actividad reciente no marcan Live como stale.

## Fase 12 — PWA y caché offline

```text
TanStack Start SSR
  ↓ primera carga online
Service Worker versionado
  ├─ precache: bundles, manifest, iconos y documentos críticos
  ├─ navegación: cache de la misma versión + fallback seguro
  └─ Network Only: /api/*, /_serverFn/*, relay/SSE y métodos mutables
```

El worker no abre bases de datos ni ejecuta migraciones. `LocalDataProvider`
realiza el bootstrap en cliente y entrega una sola instancia lógica de cada
repository al App Shell. Las rutas Main, Stage y Stream permanecen fuera del
shell y no disparan la migración de Projects.

Una actualización se instala en estado waiting. No hay `skipWaiting` ni reload
automático: Settings verifica las ventanas abiertas, bloquea la activación si
existen Live/Main/Stage/Stream y, en contexto seguro, recarga sólo la pestaña que
inició la actualización.

El relay `/api/output-relay` siempre va a red. El service worker nunca intenta
reconstruir SSE ni simular estado compartido; por eso Stream puede cargar su UI
offline pero permanece transparente sin servidor local.

## Fase 10.1 — Preview y backgrounds dinámicos

```text
RundownItem.background? (mediaId)
  → projectToPresentation
  → resolvePresentationStyles (metadata + solid del Preset congelados)
  → Slide.background: ResolvedSlideBackground
  → PresentationSurface
       ├─ BackgroundLayer
       └─ ContentLayer
  → Program / OutputSnapshot / Output
```

`PresetStyle.background` continúa siendo sólido y es siempre la base/fallback.
El asset se superpone solo si metadata y bytes pueden resolverse; ausencia o
fallo de carga/decode dejan visible ese color, nunca un negro implícito.

Project Detail actualiza el Project y deja desactualizado cualquier snapshot
Live ya cargado. El Quick Background Deck persiste el mismo RundownItem y usa
`replacePresentationItem`/`replaceInLiveSession` para sustituir solo ese item
congelado, conservando Preview, Program, Clear/Black y cualquier desfase
externo anterior. No reconstruye el show.

`OutputSnapshot` transporta el background resuelto y `cut | fade`; no transporta
eventos ni timestamps de transición. Cada `BackgroundLayer` anima localmente un
cambio real durante 500 ms. Un Output nuevo monta directamente el estado actual.
El video decorativo es muted/loop/autoplay/playsInline, no usa
`VideoPlaybackState` y no comparte controles con un video de contenido.

Las miniaturas visuales Song/Bible no usan la superficie operativa ni consultan
OPFS. `SlideThumbnailSurface` compone el mismo `SlideRenderer` y el primitive
`BackgroundVisual`; recibe el `thumbnailDataUrl` desde un mapa de metadata de
Live. Tanto imagen como video se representan mediante `<img>` estático. El
solid resuelto permanece debajo y actúa como fallback ante metadata, thumbnail
o decode ausentes. `BackgroundLayer` reutiliza el mismo primitive, pero conserva
por separado su resolución de bytes, video real y transiciones.
