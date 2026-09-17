# Fase 4 — Presentation Engine

Motor de presentación puro, determinista y sin dependencias de React, DOM ni navegador. Sin Live UI, sin outputs, sin persistencia del estado operativo.

## 1. Modelo

Se mantiene el vocabulario de `DATA_MODEL.md` y se precisa para runtime:

```ts
type SlideContent = { kind: "text"; lines: string[] }

interface Slide {
  id: string          // determinista: `${itemId}:${sectionId}:${chunkIndex}`
  itemId: string
  order: number       // 0..n-1 dentro del item
  content: SlideContent
  label?: string      // etiqueta de origen (Verso 1, Coro…)
  sourceSectionId?: string
}

type PresentationItemType = "song" | "bible" | "media" | "presentation" | "countdown" | "message"

interface PresentationItem {
  id: string
  type: PresentationItemType
  title: string
  order: number
  slides: Slide[]     // runtime: slides embebidas, no slideIds
  sourceId?: string   // id de la Song/entidad de origen
}

interface Presentation {
  items: PresentationItem[]
}
```

Diferencia intencional con el modelo persistido: el motor recibe slides ya resueltas (embebidas), no `slideIds`. Persistir slides no entra en esta fase. Esto se documenta en `DATA_MODEL.md` como "modelo de runtime".

## 2. Fuente de verdad del estado

Fuente de verdad única y mínima:

```ts
interface PresentationState {
  items: PresentationItem[]
  currentItemId: string | null
  currentSlideId: string | null
}
```

Índices (`currentItemIndex`, `currentSlideIndex`), `currentItem`, `currentSlide`, `nextSlide`, `previousSlide` son **selectores derivados**, nunca estado. Para evitar búsquedas costosas, el motor mantiene internamente un índice `Map<slideId, {itemIndex, slideIndex}>` reconstruido solo al cargar/reemplazar la presentación; navegación y selección quedan en O(1).

Invariante: si `items` tiene al menos una slide, `currentSlideId` apunta siempre a una slide existente; si no, ambos son `null`. Cualquier operación normaliza el estado hacia ese invariante.

## 3. Navegación y límites

- `next()` avanza dentro del item; en la última slide del item salta a la primera slide del siguiente item; en la última slide del último item **no hace nada** (no-op, sin wrap, sin error). Misma regla espejada para `previous()`.
- `goToFirst()` / `goToLast()` operan sobre la presentación completa (primera/última slide navegable global).
- `selectItem(id)` posiciona en la primera slide de ese item; si el item existe pero no tiene slides, se selecciona el item y `currentSlideId` queda `null`.
- `selectSlide(id)` posiciona en esa slide y sincroniza `currentItemId`.
- Los items sin slides se **saltan** durante `next`/`previous` (no bloquean la navegación).

Todos los comandos devuelven un **nuevo estado inmutable** (funciones puras `(state, command) => state`), sin clonado profundo de slides: se reutilizan las referencias existentes.

## 4. Estados vacíos e IDs inválidos

- `load([])` → estado vacío; `next`/`previous`/`goToFirst`/`goToLast` son no-ops.
- `selectItem`/`selectSlide` con id inexistente → estado sin cambios (no lanza excepción). El motor nunca produce referencias imposibles.
- `load()` con una presentación nueva intenta **preservar** la posición si el `currentSlideId` sigue existiendo; si desapareció, cae a la primera slide del item si aún existe, y si no, a la primera slide de la presentación; si no queda ninguna, a `null`.
- `reset()` vuelve al estado inicial vacío.

## 5. Song → PresentationItem

Sí se implementa en esta fase, como transformación **pura** e independiente de Projects:

```ts
songToPresentationItem(song: Song, options?): PresentationItem
```

Estrategia de división (versión 1, simple y determinista): **una sección = una slide**. El contenido se normaliza a líneas (`split("\n")`, se recortan líneas en blanco al inicio/fin). Las secciones cuyo contenido queda vacío se omiten. El `label` de la sección se copia en la slide.

Motivo: dividir por número de líneas o por altura requiere conocer tipografía y tamaño de output, que pertenecen a Presets (Fase 7) y Outputs (Fase 6). Para no cerrar la puerta, la firma acepta un parámetro opcional `splitStrategy` con una única implementación registrada hoy (`wholeSection`), de modo que en Fase 7 se añada `maxLinesPerSlide` sin tocar llamadas existentes.

IDs de slide deterministas: `${itemId}:${sectionId}:${chunkIndex}` — estables entre conversiones repetidas de la misma canción, lo que permite reconciliar posición tras editar.

## 6. Preview vs Program

Se **pospone** la separación. En esta fase existe una sola posición (`currentSlideId`). Añadir ahora `selectedSlideId` + `programSlideId` duplicaría estado sin ningún consumidor y contradice el principio de evitar estado derivable/innecesario.

Mitigación arquitectónica: los selectores públicos se llaman `getProgramSlide()` / `getProgramItem()` desde el inicio. Cuando Live introduzca Preview (Fase 5), se añade `previewSlideId` como estado adicional y un comando `takeToProgram()` sin renombrar nada de lo que ya consuman los outputs.

Igualmente, `clear` / `black` / `logo` quedan **fuera**: son estado de salida, no de contenido. No se añade ningún campo placeholder.

## 7. Estado global: decisión

**Opción B — store vanilla propio, sin dependencias nuevas.**

- El dominio (`src/domain/presentation/`) son funciones puras: `createInitialState`, `load`, `next`, `previous`, `selectItem`, `selectSlide`, `goToFirst`, `goToLast`, `reset` + selectores.
- Encima, un store mínimo framework-agnóstico (~40 líneas): `getState()`, `subscribe(listener)`, y métodos que aplican los comandos puros. Es exactamente el contrato que consume `useSyncExternalStore` de React 19, y también una ventana de output o un futuro puente de sincronización, sin pasar por React.
- En React: `PresentationProvider` + `usePresentation()` sobre `useSyncExternalStore`.

Por qué no Zustand: aportaría prácticamente lo mismo que estas ~40 líneas, mientras que el requisito duro (motor independiente de React) ya obliga a la separación dominio/store. Por qué no Context+reducer solo: ataría el estado al árbol de React, y las ventanas de output de Fase 6 no comparten árbol. Se registra como ADR-014/015.

## 8. Archivos

Crear:

- `src/domain/presentation/presentation.ts` — tipos (`Slide`, `PresentationItem`, `PresentationState`).
- `src/domain/presentation/presentation-engine.ts` — comandos puros + índice interno.
- `src/domain/presentation/presentation-selectors.ts` — selectores derivados.
- `src/domain/presentation/song-to-presentation.ts` — transformación Song → PresentationItem.
- `src/stores/presentation-store.ts` — store vanilla con `subscribe`.
- `src/features/presentation/presentation-context.tsx` — provider + hooks con `useSyncExternalStore`.
- `tests/domain/presentation-engine.test.ts`
- `tests/domain/song-to-presentation.test.ts`
- `tests/stores/presentation-store.test.ts`

Modificar (solo documentación): `docs/ROADMAP.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`.

No se modifican Projects, Songs, rutas, App Shell, `package.json` ni `bun.lock`. No se crea UI ni harness temporal: la validación es por tests.

## 9. Tests (`bun test`)

- **Vacío**: load vacío, next/previous/goToFirst/goToLast no-ops, selección inexistente.
- **Navegación**: seleccionar item y slide, next/previous dentro del item, cruce entre items en ambos sentidos, límites inicial y final sin wrap, saltar items sin slides.
- **Mutaciones**: reemplazar presentación preservando posición, posición perdida, item sin slides, IDs inválidos, reset.
- **Songs**: conversión determinista (mismos IDs en dos ejecuciones), orden de secciones y slides, sección vacía omitida, múltiples secciones, canción sin secciones.
- **Store**: notificación a suscriptores, `unsubscribe`, identidad de estado estable cuando un comando no cambia nada (evita renders inútiles).
- **Selectores**: derivación correcta de índices, next/previous slide en bordes.

## 10. ADR propuestas

- **ADR-014 — Presentation Engine como dominio puro**: comandos puros + selectores derivados; `currentSlideId` como única fuente de verdad posicional.
- **ADR-015 — Store vanilla en lugar de Zustand**: cierra ADR-008 sin añadir dependencias.
- **ADR-016 — Slides de runtime derivadas**: las slides no se persisten en Fase 4; se derivan de la Song mediante transformación determinista.
- **ADR-017 — Preview/Program pospuesto**: una sola posición ahora, nomenclatura `program*` desde el inicio.

## 11. Fuera de alcance

Rundown funcional, Songs en Projects, drag & drop, Live UI, Preview UI, Program UI, outputs (`/output/*`), BroadcastChannel, Remote, Bible, Media, Presets, PWA, IndexedDB, Supabase, Sync, Clear/Black/Logo, transiciones, backgrounds, lower thirds, video.

## 12. Riesgos y decisiones que requieren tu aprobación

1. **Una sección = una slide**: canciones con secciones muy largas producirán slides con demasiado texto hasta Fase 7. Aceptado como versión 1.
2. **Slides embebidas en el item de runtime** en lugar de `slideIds`: divergencia consciente respecto al modelo persistido documentado.
3. **Preview/Program pospuesto**: si prefieres la separación desde ya, lo ajusto antes de ejecutar.
4. **Store propio en vez de Zustand**: cero dependencias nuevas, a cambio de ~40 líneas mantenidas por nosotros.
5. **Sin UI de validación**: el motor no será observable en el navegador hasta la Fase 5; toda la confianza viene de los tests.
