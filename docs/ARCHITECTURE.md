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
  currentItemId: string | null
  currentSlideId: string | null
  nextSlideId: string | null
  previousSlideId: string | null
  isLive: boolean
  isBlack: boolean
  isClear: boolean
  showLogo: boolean
  activePresetId: string | null
  activeOutputs: string[]
}
```

Acciones principales:

```text
goNext()
goPrevious()
goToSlide()
clear()
black()
showLogo()
hideLogo()
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

IndexedDB se utilizará para:

- Proyecto actual.
- Canciones.
- Biblia descargada.
- Presets.
- Configuración.
- Estado de sesión.
- Metadata de medios.
- Cola de sincronización.

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

### Projects en Fase 2

La primera implementación concreta respeta este flujo:

```text
UI → ProjectsProvider / ProjectService → ProjectRepository → localStorage temporal
```

El contrato del repository es asíncrono y contiene solo operaciones de
persistencia. Reglas como validar, renombrar o duplicar pertenecen al dominio y
al servicio. El adaptador de `localStorage` se reemplazará por IndexedDB sin
modificar los componentes.

`ProjectsProvider` usa Context de React para compartir Projects y
`activeProjectId` entre rutas y shell. No es el store global del Presentation
Engine, que continúa diferido a la Fase 4 según ADR-008.

La carga desde `localStorage` ocurre después del montaje en cliente. SSR y el
primer render usan estado de carga y nunca acceden a APIs del navegador.

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

Fase 0 no define ni conecta backend. La decisión de backend (Supabase u otra)
pertenece a la Fase 12; hasta entonces ningún módulo asume su existencia.

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
  ↓
/output/main — superficie fuera del App Shell, solo representa Program
```

Flujo unidireccional: Live es la única autoridad; Output nunca envía
comandos. El transporte es una interfaz (`OutputTransport`) con
implementación BroadcastChannel en el navegador y en memoria para tests;
los componentes React no acceden al canal. Sin sesión válida la superficie
es negro puro (ADR-030).

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

`src/domain/media/` (tipos y reglas puras) → `src/services/media/` (repositorio, storages, caché de URLs por ventana, persistencia) → `src/features/media/media-service.ts` (coordinador) → `media-context.tsx` (`MediaProvider`, `useMedia`, `useMediaUrl`) montado en `_app.tsx` y `output.main.tsx`. `SlideContent` es unión discriminada `text | image | video`; `MediaSlideSurface` renderiza image/video en Live y Output. La firma de presentación incorpora los assets por `updatedAt` para baja incremental en Live.
