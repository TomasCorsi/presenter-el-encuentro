# Fase 6 — Live Mode

Convertir `/live` en la consola de operación real sobre el Project activo, con separación Preview/Program, TAKE, navegación y estados de salida. Sin `/output/main`, sin BroadcastChannel, sin persistencia del estado live.

## 1. Evolución de PresentationState

`PresentationRuntime`, `Slide` y `PresentationItem` no cambian. Cambia únicamente la posición:

```ts
type ProgramMode = "content" | "clear" | "black";

interface PresentationState {
  runtime: PresentationRuntime;
  previewItemId: string | null;
  previewSlideId: string | null;
  programSlideId: string | null;   // única fuente de verdad de Program
  programMode: ProgramMode;
}
```

- `currentItemId` / `currentSlideId` se renombran a `previewItemId` / `previewSlideId`. Toda la lógica actual de navegación, items vacíos y límites se conserva tal cual: solo opera sobre Preview.
- Program guarda **un solo id**: `programSlideId`. `programItemId` no se almacena — se deriva con `slideLocationById`, evitando pares contradictorios.
- `programMode` es estado operativo de salida, no de contenido: cambiar de modo nunca altera `programSlideId`.

Selectores derivados nuevos en `presentation-selectors.ts`: `getPreviewItem`, `getPreviewSlide`, `getProgramSlide`, `getProgramItem`, `getProgramOutput()` (devuelve `{ mode, slide }`, con `slide: null` en clear/black), `isSlideInProgram(id)`, `isItemInProgram(id)`. Se mantienen `getNextSlide` / `getPreviousSlide` referidos a Preview.

Rename de `getCurrentItem` / `getCurrentSlide` → `getPreviewItem` / `getPreviewSlide`, cierre previsto de ADR-017.

## 2. Comandos del motor

Puros, misma firma `(state, ...) => state`, misma referencia cuando no cambian nada:

- `loadPresentation(state, items)` — inicio o cambio de show: reconstruye runtime, posiciona Preview según la estrategia de Fase 4, y siempre `programSlideId = null` y `programMode = "content"`.
- `reloadPresentation(state, items)` — solo tras la acción explícita **Recargar presentación**: reconstruye runtime, conserva Preview si su slide (o su item) sigue existiendo, conserva `programSlideId` únicamente si ese id sigue existiendo y, si no, lo pone a `null`. `programMode` se conserva solo mientras siga habiendo Program; sin Program vuelve a `"content"`.
- Son dos comandos explícitos y testeables por separado: la diferencia nunca se infiere de un flag de UI.
- `selectItem`, `selectSlide`, `next`, `previous`, `goToFirst`, `goToLast` — sin cambios semánticos, actúan sobre Preview.
- `take(state)` — siempre establece `programSlideId = previewSlideId` y `programMode = "content"`. No-op si no hay slide de Preview (item vacío o referencia rota). Nunca mueve Preview.
- `setProgramMode(state, mode)` — `content | clear | black`. Nunca toca `programSlideId`.
- No se añade ningún comando que vacíe Program: en Fase 6 no hay caso de uso (Clear y Black cubren "sacar del aire" de forma reversible). Si apareciera, se llamaría `resetProgram()`, nunca `clearProgram()`.
- `reset()` — estado inicial vacío.


El motor no gana flags de UI: solo cinco campos y comandos explícitos.

## 3. Semántica operativa elegida

- **Selección → Preview; TAKE → Program.** Click simple nunca manda al aire; evita el error accidental más caro en producción. Sin doble click, sin modo "auto-live" en esta fase.
- **Next / Previous mueven Preview.** Una sola semántica, consistente en teclado y botones. El modo rápido "Next avanza Program" queda fuera de Fase 6 (riesgo listado abajo).
- **Items sin slides / referencias rotas**: seleccionables en Preview, `previewSlideId = null`, TAKE deshabilitado y no-op. Program conserva lo que tuviera.
- **Presentación vacía**: Live muestra estado vacío; todos los controles deshabilitados.

## 4. Clear / Black / Logo

Entran `clear` y `black`. **Logo se pospone**: sin Presets ni Media no hay asset real ni configuración, y un botón muerto no aporta. El tipo `ProgramMode` se amplía en la fase de Presets sin romper nada.

Semántica: `content` muestra la slide de Program; `clear` = salida vacía (sin texto); `black` = salida negra. Son **modos temporales de salida**: `programSlideId` se conserva intacto, así que volver a `content` devuelve al aire exactamente la misma slide. Clear/Black son conmutables: pulsar de nuevo regresa a `content`.

## 5. Carga del Project activo: snapshot explícito

Live toma un **snapshot** al cargar: lee el Project activo y las Songs, ejecuta `projectToPresentation(project, songs)` y hace `store.load(items)`. Después, ni editar el rundown ni editar una canción alteran el show en curso.

Justificación: durante la operación, un cambio silencioso de contenido es un fallo de producción, no una mejora. Además, al recomponer desde Projects cambiarían ids de slide y Program podría apuntar a nada.

Detección de desfase: se guarda una firma del origen (`project.updatedAt` + `updatedAt` de las Songs referenciadas). Si difiere del snapshot, Live muestra un aviso no intrusivo con acción **Recargar presentación**, que recompone y aplica `load`.

**Cambio de Project activo con `/live` abierto**: no se recarga nada. Se muestra `El proyecto activo cambió a "X"` con acción **Cargar este proyecto**. Sin acción explícita, el show sigue operando el snapshot anterior.

**Sin Project activo**: estado claro `No hay proyecto activo` con enlace a Projects. No se carga una presentación vacía.

## 6. Layout de `/live`

Página full-width, densidad broadcast, sin scroll global (cada columna con scroll propio).

```text
┌──────────────────────────────────────────────────────────────┐
│ barra de show: proyecto · avisos (desfase / cambio) · recarga│
├────────────┬───────────────────────┬─────────────────────────┤
│ RUNDOWN    │ PREVIEW  16:9         │ PROGRAM 16:9  (acento   │
│ nº título  │ texto de la slide     │ rojo solo si hay        │
│ tipo       │ seleccionada          │ contenido al aire)      │
│ faltante   │                       │ badge PROGRAM / CLEAR   │
│ en program │                       │ / BLACK                 │
├────────────┴───────────────────────┴─────────────────────────┤
│ SLIDES del item seleccionado (rejilla compacta: nº, label,   │
│ extracto; marca de Preview y marca de Program)               │
├──────────────────────────────────────────────────────────────┤
│ CONTROLES: Previous · Next · TAKE · Clear · Black            │
└──────────────────────────────────────────────────────────────┘
```

Solo tokens semánticos; rojo de Program vía token de estado existente (`live`). Controles con estado disabled, foco visible, tooltip y atajo mostrado. En móvil las columnas se apilan (Program, Preview, rundown, slides) sin degradar el desktop.

Live no edita el rundown: sin agregar, quitar ni reordenar.

## 7. Teclado

Un hook `useLiveKeyboard` en la ruta Live, con `keydown` en `window`:

- `ArrowLeft` → Previous, `ArrowRight` → Next, `Enter` o `Space` → TAKE.
- Se ignora el evento si `event.defaultPrevented`, si hay modificadores (Ctrl/Meta/Alt), o si el foco está en `input`, `textarea`, `select`, `[contenteditable]` o dentro de un diálogo abierto.
- Cuando el atajo se reconoce y se ejecuta realmente, se llama a `event.preventDefault()`: obligatorio en Space (scroll), flechas (scroll/desplazamiento) y Enter.
- Solo activo mientras `/live` está montado y hay presentación cargada; nunca se interceptan teclas fuera de `/live`.

Sin sistema configurable de atajos.

## 8. Archivos

Crear:
- `src/domain/presentation/presentation-program.ts` — `ProgramMode`, `take`, `setProgramMode`.
- `src/features/live/live-presentation.ts` — construcción del snapshot y firma de origen (puro, testeable).
- `src/features/live/use-live-keyboard.ts`
- `src/features/live/components/live-rundown.tsx`
- `src/features/live/components/live-slide-grid.tsx`
- `src/features/live/components/slide-surface.tsx` — superficie 16:9 compartida por Preview y Program.
- `src/features/live/components/live-monitors.tsx` — Preview + Program.
- `src/features/live/components/live-controls.tsx`
- `src/features/live/components/live-show-bar.tsx` — proyecto, avisos y recarga.
- `tests/domain/presentation-program.test.ts`
- `tests/features/live-presentation.test.ts`

Modificar:
- `src/domain/presentation/presentation.ts` — nuevo `PresentationState`.
- `src/domain/presentation/presentation-engine.ts` — rename a Preview, `load` con descarte de Program.
- `src/domain/presentation/presentation-selectors.ts` — selectores Preview/Program.
- `src/stores/presentation-store.ts` — comandos `take`, `setProgramMode`, `clearProgram`.
- `src/features/presentation/presentation-context.tsx` — sin cambios estructurales, snapshot SSR actualizado.
- `src/routes/_app.live.tsx` — la consola real, envuelta en `SongsProvider` y `PresentationProvider`.
- Tests existentes de engine/store/selectores.
- `docs/ROADMAP.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`.

Sin dependencias nuevas; sin tocar `package.json` ni el lockfile.

## 9. Tests (`bun test`)

Preview independiente de Program; selección de item y de slide; TAKE con y sin slide (siempre fija `content`); cambiar Preview sin alterar Program; Next/Previous y límites sin wrap; items sin slides y referencias rotas (TAKE no-op); presentación vacía; Clear/Black conservando `programSlideId` y vuelta a Content recuperando la misma slide; `loadPresentation` descartando Program; `reloadPresentation` conservando Preview y Program cuando los ids persisten y anulando Program cuando desaparece; snapshot y firma de origen (cambio de rundown y de canción detectado); cambio de Project activo sin recarga automática; teclado: atajo reconocido llama a `preventDefault`, foco en input no dispara nada; store: notifica solo al cambiar, no-op mantiene referencia.

## 10. ADR propuestas

- **ADR-022 — Preview y Program separados**: `previewSlideId` + `programSlideId`; `programItemId` derivado; cierre de ADR-017.
- **ADR-023 — Live opera sobre un snapshot**: carga explícita, detección de desfase y recarga manual; el Project activo no cambia el show en curso sin acción del operador.
- **ADR-024 — ProgramMode como estado de salida**: `content | clear | black`, ortogonal al contenido; Logo pospuesto hasta Presets/Media.
- **ADR-025 — Selección + TAKE**: el click nunca manda al aire; Next/Previous mueven Preview.

## 11. Fuera de alcance

`/output/main`, output externo, Stage Display, Stream, BroadcastChannel, Remote, Supabase, IndexedDB, PWA, Sync, Presets, backgrounds, tipografía configurable, transiciones, vídeo, lower thirds, Bible, Media, edición del rundown desde Live, persistencia del estado live.

## 12. Riesgos y decisiones que requieren tu aprobación

1. **Logo pospuesto** (no se añade botón sin contenido real).
2. **Next/Previous solo mueven Preview** en Fase 6; sin modo rápido que avance Program.
3. **`load` descarta Program** salvo que la misma slide siga existiendo en una recarga explícita.
4. **Rename Preview** de los selectores actuales: toca tests y firmas existentes de Fase 4.
5. **Detección de desfase por `updatedAt`**, no comparación profunda de contenido: barata y suficiente, con posible falso positivo si se guarda sin cambios reales.
6. **Sin persistencia**: recargar la página reinicia la sesión en vivo, incluido lo que estaba al aire.
