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
