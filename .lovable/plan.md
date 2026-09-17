# Fase 9.1 — Live Operator Workspace + Library Dock

Objetivo: que `/live` permita operar una reunión completa sin salir de la pantalla, con controles siempre visibles, proyección en un solo clic y una biblioteca de búsqueda rápida abajo.

Referencia solo conceptual (distribución y flujo). Nada del aspecto visual de EasyWorship ni ProPresenter.

## 1. Un clic proyecta

Hoy un clic en una slide solo cambia Preview y hay que confirmar con TAKE.

- Un clic en una slide de la rejilla la manda al aire directamente (Program) y Preview queda en esa misma slide.
- TAKE sigue existiendo para el flujo preparado (mover Preview con las flechas y confirmar), y para volver a mandar al aire la slide seleccionada.
- Clic en un item del rundown sigue cargando sus slides en Preview sin tocar el aire: cambiar de canción nunca proyecta sola.
- Clear y Black siguen mandando: si la salida está vacía o en negro, el clic cambia el contenido interno y la salida sigue vacía o negra.

## 2. Controles siempre a la vista

- Barra de operación fija arriba, debajo de la barra de show: Previous, Next, TAKE, Clear, Black y el campo de búsqueda rápida.
- Nunca requiere scroll: el resto del espacio es el que se comprime.
- Atajos actuales sin cambios (flechas, Enter/Espacio) y se agregan: `B` negro, `C` vacío, `/` enfoca la búsqueda, `Esc` cierra la biblioteca.
- Los atajos se desactivan mientras se escribe en un campo de texto.

## 3. Distribución

```text
SHOW BAR        Proyecto · estado · Recargar · Abrir Output
OPERACIÓN       ◀ Prev   Next ▶   TAKE   CLEAR   BLACK   Buscar…
RUNDOWN  |  SLIDES (zona principal)  |  PROGRAM (16:9)
         |                           |  PREVIEW (compacta)
LIBRARY DOCK    Songs | Bible   ·  buscador  ·  resultados
```

- Tres columnas con scroll propio, como hoy.
- La biblioteca de abajo es colapsable: cerrada deja solo su barra de pestañas; abierta ocupa una franja fija y las columnas de arriba se comprimen.
- Se recuerda si quedó abierta o cerrada entre sesiones del navegador.

## 4. Biblioteca operativa (Songs y Bible)

Dos pestañas por ahora: Songs y Bible. Media y Presentations llegan en sus fases.

- Songs: buscador por título/autor sobre las canciones ya cargadas; resultados con nombre y cantidad de secciones.
- Bible: campo de referencia igual al de la pantalla Bible (por ejemplo `jn 3:16-18`), usando la traducción instalada elegida en un selector; muestra el pasaje encontrado.
- Cada resultado ofrece dos acciones:
  - **Agregar al rundown**: se agrega al final del rundown del proyecto activo y queda guardado en el proyecto.
  - **Enviar al aire**: se agrega al final del rundown, se recarga el show conservando lo que está al aire, y su primera slide se proyecta de inmediato.
- Ambas guardan en el proyecto activo, así que la próxima vez el contenido ya está ahí.
- Sin proyecto activo, las acciones quedan deshabilitadas con el motivo visible.

## 5. Lo que NO cambia

Presentation Engine, Output Sync, Presets, Songs, Projects, la lógica de Clear/Black y la pantalla Output Main. Sin dependencias nuevas.

## Detalles técnicos

- Nuevo comando de dominio `takeSlide(state, slideId)` en `presentation-live.ts`: selecciona la slide y la pone en Program en un solo paso, sin tocar `programMode`; el store lo expone como `store.goLive(slideId)`. `selectSlide`, `take`, `nextLive` y `previousLive` quedan intactos.
- `live-slide-grid.tsx`: `onSelect` pasa a `onGoLive`; se conserva el resaltado doble PREVIEW/PROGRAM y los `aria-label`.
- `_app.live.tsx` se reorganiza: `LiveShowBar`, nueva `LiveOperationBar` (mueve `LiveControls` arriba y añade el atajo de búsqueda), grilla de tres columnas con `min-h-0`, y `LiveLibraryDock` abajo.
- Nuevos componentes en `src/features/live/components/`: `live-operation-bar.tsx`, `live-library-dock.tsx`, `library-songs-tab.tsx`, `library-bible-tab.tsx`, `library-result-row.tsx`. Solo presentación + handlers.
- Búsqueda pura y testeable en `src/features/live/library-search.ts` (`searchSongs(songs, query)`), sin dependencias.
- Alta desde Live: reutiliza `projects-context` (`addSongToProject` / `addPassageToProject`); luego `reloadPresentation` con el snapshot nuevo (conserva Preview y Program) y, en "Enviar al aire", `goLive` sobre la primera slide del item recién agregado.
- Bible dentro de Live usa `useBible().getChapter` + `buildPassage`; Live sigue sin tocar IndexedDB directamente (pasa por el contexto/servicio) y Output sigue sin conocer Bible.
- Estado del dock (abierto/cerrado, pestaña, versión elegida) en `localStorage` con lectura tras montaje para no romper SSR.
- `use-live-keyboard.ts`: agrega `b`, `c`, `/` y `Esc`, e ignora eventos originados en `input`/`textarea`/`contenteditable`.
- Tests: `tests/domain/presentation-live.test.ts` (takeSlide proyecta y respeta clear/black), `tests/features/library-search.test.ts`, y un test de integración de "agregar desde Live" que verifica que el proyecto queda guardado y el snapshot recargado conserva Program.
- Verificación: `bun test`, `bunx tsgo --noEmit`, `bun run build` y prueba en navegador a 1920×1080 y 1366×768.
- Docs: ROADMAP (Fase 9.1), DECISIONS (ADR sobre "un clic proyecta" y sobre alta de contenido desde Live persistida en el proyecto), DESIGN_SYSTEM y TESTING.
