# Fase 4 — Presentation Engine

Motor de presentación puro, determinista y sin dependencias de React, DOM ni navegador. Sin Live UI, sin outputs, sin persistencia del estado operativo.

## 1. Modelo

Se mantiene el vocabulario de `DATA_MODEL.md` y se precisa para runtime:

```ts
type SlideContent = { kind: "text"; lines: string[] }

interface Slide {
  id: string          // `${itemId}:${sectionId}:${chunkIndex}`
  itemId: string
  order: number       // 0..n-1 dentro del item
  content: SlideContent
  label?: string      // etiqueta de origen (Verso 1, Coro…)
  sourceSectionId?: string
}

type PresentationItemType = "song" | "bible" | "media" | "presentation" | "countdown" | "message"

interface PresentationItem {
  id: string          // identidad de ESTA instancia dentro de la presentación
  type: PresentationItemType
  title: string
  order: number
  slides: Slide[]     // runtime: slides embebidas, no slideIds
  sourceId?: string   // identidad de la entidad original (song.id)
}
```

Diferencia intencional con el modelo persistido: el motor recibe slides ya resueltas (embebidas), no `slideIds`. Persistir slides no entra en esta fase. Se documenta en `DATA_MODEL.md` como "modelo de runtime".

**Identidad de instancia vs. identidad de origen**: `item.id` identifica la aparición concreta dentro de una presentación; `sourceId` apunta a la Song original. Así una misma canción puede repetirse en un futuro rundown (A, B, A) sin colisiones de IDs de item ni de slide.

## 2. Runtime derivado y fuente de verdad

Los índices de navegación son **datos derivados explícitos**, no un cache mutable escondido dentro del motor:

```ts
interface PresentationRuntime {
  items: readonly PresentationItem[]
  itemIndexById: ReadonlyMap<string, number>
  slideLocationById: ReadonlyMap<string, { itemIndex: number; slideIndex: number; navigableIndex: number }>
  navigableSlideIds: readonly string[]   // orden global de slides navegables
}

function buildPresentationRuntime(items: PresentationItem[]): PresentationRuntime

interface PresentationState {
  runtime: PresentationRuntime
  currentItemId: string | null
  currentSlideId: string | null
}
```

- `buildPresentationRuntime` es una función pura, llamada **solo** cuando cambia la presentación (`load`).
- El runtime es inmutable y congelado conceptualmente; los comandos jamás lo mutan.
- Navegación y selección en O(1) mediante `slideLocationById` + `navigableSlideIds`.
- Fuente de verdad posicional: `currentItemId` + `currentSlideId`. Índices, `currentItem`, `currentSlide`, `nextSlide`, `previousSlide` son **selectores derivados**, nunca estado almacenado.

## 3. Semántica de items sin slides

Invariantes (sin contradicción):

1. `currentItemId` puede apuntar a un item válido **aunque ese item no tenga slides**.
2. `currentSlideId` es `null` cuando el item seleccionado no tiene slides.
3. Si `currentSlideId !== null`, siempre apunta a una slide **perteneciente a `currentItemId`**.

Comportamiento desde un item vacío:

- `next()` → primera slide navegable de los items **posteriores**; si no existe, no-op.
- `previous()` → última slide navegable de los items **anteriores**; si no existe, no-op.

Durante la navegación normal, los items sin slides se **saltan** (no bloquean ni detienen el recorrido).

## 4. Navegación y límites

- `next()` avanza dentro del item; en la última slide del item salta a la primera slide del siguiente item con slides; en la última slide navegable global es **no-op** (sin wrap, sin excepción). Espejado para `previous()`.
- `goToFirst()` / `goToLast()` → primera / última slide navegable global.
- `selectItem(id)` → primera slide del item; si el item no tiene slides, se aplica la regla de la sección 3.
- `selectSlide(id)` → esa slide, sincronizando `currentItemId`.

Todos los comandos son funciones puras `(state, ...) => state` que devuelven estado nuevo e inmutable, reutilizando referencias de slides y del runtime (sin clonado profundo).

## 5. Estados vacíos e IDs inválidos

- `load([])` → estado vacío; `next` / `previous` / `goToFirst` / `goToLast` son no-ops.
- `selectItem` / `selectSlide` con id inexistente → estado **sin cambios** (misma referencia), nunca excepción ni referencia imposible.
- `load()` con presentación nueva preserva la posición si `currentSlideId` sigue existiendo; si no, cae a la primera slide del item si aún existe; si no, a la primera slide navegable; si no queda ninguna, a `null`.
- `reset()` vuelve al estado inicial vacío.

## 6. Song → PresentationItem

Transformación pura, independiente de Projects:

```ts
songToPresentationItem(song: Song, options: { itemId: string; order?: number }): PresentationItem
```

- `item.id = options.itemId` (suministrado por quien compone la presentación; en Fase 4 lo suministran los tests).
- `sourceId = song.id`, `type = "song"`, `title = song.title`.
- IDs de slide: `${itemId}:${sectionId}:${chunkIndex}` — estables mientras se use el mismo `itemId`, y sin colisiones al repetir la canción con otro `itemId`.

**División (versión 1): una sección = una slide.** El contenido se normaliza a líneas (`split("\n")`, recorte de líneas en blanco al inicio y al final). Las secciones cuyo contenido queda vacío se omiten. El `label` de la sección se copia en la slide.

Sin abstracción `splitStrategy` en esta fase: existiría una sola implementación. La firma ya recibe un objeto `options`, así que añadir `maxLinesPerSlide` en Fase 7 no rompe llamadas existentes. Motivo de la estrategia simple: dividir por líneas o altura requiere tipografía y tamaño de output, que pertenecen a Presets (Fase 7) y Outputs (Fase 6).

## 7. Preview vs Program

Se **pospone** la separación: una sola posición (`currentSlideId`). Añadir hoy `selectedSlideId` + `programSlideId` duplicaría estado sin consumidores.

Nomenclatura **neutral** ahora: `getCurrentSlide()` / `getCurrentItem()`. No se usa `getProgramSlide()` / `getProgramItem()`, porque el estado actual todavía no representa Program; introducir esa semántica hoy sería falsa. En Fase 5, cuando existan `previewSlideId` y `programSlideId`, se hará un rename controlado y se añadirán `getPreviewSlide()` / `getProgramSlide()`. Queda registrado en la ADR.

`clear` / `black` / `logo` quedan fuera: son estado de salida, no de contenido. No se añade ningún campo placeholder.

## 8. Estado global: store vanilla, sin Zustand

- Dominio (`src/domain/presentation/`): funciones puras y runtime derivado.
- Store mínimo framework-agnóstico (~40 líneas): `getState()`, `subscribe(listener)`, métodos que aplican los comandos puros. Si un comando no cambia nada, devuelve la misma referencia de estado y **no** notifica (evita renders inútiles).
- React: `PresentationProvider` + `usePresentation()` sobre `useSyncExternalStore`, con `getServerSnapshot` explícito (estado inicial determinista) para SSR en TanStack Start.

Documentar explícitamente que el store permite suscripciones **dentro de un mismo runtime JS**, que **no** sincroniza ventanas distintas por sí mismo, y que la sincronización entre ventanas llegará por otro mecanismo en su fase.

Por qué no Zustand: aportaría lo mismo que estas ~40 líneas y el requisito de independencia de React ya obliga a separar dominio y store. Por qué no Context+reducer solo: ataría el estado al árbol de React, y las ventanas de output de Fase 6 no comparten árbol.

## 9. Archivos

Crear:

- `src/domain/presentation/presentation.ts` — tipos (`Slide`, `PresentationItem`, `PresentationRuntime`, `PresentationState`).
- `src/domain/presentation/presentation-runtime.ts` — `buildPresentationRuntime`.
- `src/domain/presentation/presentation-engine.ts` — comandos puros.
- `src/domain/presentation/presentation-selectors.ts` — selectores derivados (`getCurrentItem`, `getCurrentSlide`, `getNextSlide`, `getPreviousSlide`, índices).
- `src/domain/presentation/song-to-presentation.ts` — transformación Song → PresentationItem.
- `src/stores/presentation-store.ts` — store vanilla con `subscribe`.
- `src/features/presentation/presentation-context.tsx` — provider + hooks con `useSyncExternalStore` y server snapshot.
- `tests/domain/presentation-runtime.test.ts`
- `tests/domain/presentation-engine.test.ts`
- `tests/domain/song-to-presentation.test.ts`
- `tests/stores/presentation-store.test.ts`

Modificar (solo documentación): `docs/ROADMAP.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`.

No se modifican Projects, Songs, rutas, App Shell, `package.json` ni `bun.lock`. No se crea UI ni harness temporal: la validación es por tests.

## 10. Tests (`bun test`)

- **Runtime**: construcción de índices, orden global de slides navegables, items vacíos excluidos de `navigableSlideIds` pero presentes en `itemIndexById`, inmutabilidad.
- **Vacío**: load vacío, comandos no-op, selección inexistente.
- **Navegación**: seleccionar item y slide, next/previous dentro del item, cruce entre items en ambos sentidos, límites inicial y final sin wrap, items sin slides saltados.
- **Items vacíos**: `selectItem` sobre item sin slides (item seleccionado, slide `null`), `next` desde item vacío hacia slide posterior, `previous` hacia slide anterior, no-op cuando no hay nada en esa dirección.
- **Mutaciones**: reemplazar presentación preservando posición, posición perdida, IDs inválidos, reset.
- **Songs**: conversión determinista (mismos IDs en dos ejecuciones con el mismo `itemId`), misma Song con dos `itemId` distintos sin colisiones, `sourceId` correcto, orden de secciones y slides, sección vacía omitida, canción sin secciones.
- **Store**: notificación a suscriptores, `unsubscribe`, identidad de estado estable y sin notificación cuando un comando no cambia nada.
- **Selectores**: derivación de índices, next/previous en bordes.

## 11. ADR propuestas

- **ADR-014 — Presentation Engine como dominio puro**: comandos puros, runtime derivado explícito mediante `buildPresentationRuntime`, sin caches mutables ocultos; `currentItemId` + `currentSlideId` como única fuente de verdad posicional, con la semántica de items vacíos documentada.
- **ADR-015 — Store vanilla en lugar de Zustand**: cierra ADR-008 sin dependencias nuevas; alcance limitado a un runtime JS, sin sincronización entre ventanas.
- **ADR-016 — Slides de runtime derivadas**: no se persisten en Fase 4; identidad de instancia (`item.id`) separada de identidad de origen (`sourceId`); IDs de slide `${itemId}:${sectionId}:${chunkIndex}`.
- **ADR-017 — Nomenclatura neutral y Preview/Program pospuesto**: `getCurrentSlide()` / `getCurrentItem()` hoy; rename controlado en Fase 5 en lugar de semántica falsa anticipada.

## 12. Fuera de alcance

Rundown funcional, Songs en Projects, drag & drop, Live UI, Preview UI, Program UI, outputs (`/output/*`), BroadcastChannel, Remote, Bible, Media, Presets, PWA, IndexedDB, Supabase, Sync, Clear/Black/Logo, transiciones, backgrounds, lower thirds, video.

## 13. Riesgos y decisiones

1. **Una sección = una slide**: secciones largas producirán slides con mucho texto hasta Fase 7. Aprobado provisionalmente.
2. **Slides embebidas en el item de runtime** en lugar de `slideIds`: divergencia consciente respecto al modelo persistido.
3. **Rename en Fase 5** de los selectores actuales cuando aparezca Program: aceptado como preferible a semántica anticipada.
4. **Store propio**: cero dependencias nuevas a cambio de ~40 líneas propias; sin sincronización entre ventanas.
5. **Sin UI de validación**: el motor no será observable en el navegador hasta Fase 5; la confianza viene de los tests.
