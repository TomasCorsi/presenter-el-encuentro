# Testing Strategy

## Objetivo

Mantener confiables las funciones críticas sin sobreingeniería.

## Prioridades

### Nivel 1 — Presentation Engine

Probar:

- Next.
- Previous.
- Ir a slide específico.
- Clear.
- Black.
- Logo.
- Cambio de item.
- Límites de navegación.

### Nivel 2 — Projects

Probar:

- Orden.
- Drag & drop.
- Agregar.
- Eliminar.
- Duplicar.
- Persistencia.

### Nivel 3 — Presets

Probar:

- Aplicación de preset.
- Defaults.
- Overrides.
- Layout por output.

### Nivel 4 — Offline

Probar:

- Lectura local.
- Escritura local.
- Reconexión.
- Cola de cambios.
- No bloquear Live.

### Nivel 5 — Sync

Probar:

- Local → Cloud.
- Cloud → Local.
- Retry.
- Error.
- Conflictos.

## E2E críticos

### Presentación básica

1. Abrir proyecto.
2. Iniciar Live.
3. Cambiar slides.
4. Clear.
5. Black.
6. Logo.
7. Verificar Main Output.

### Sin Internet

1. Abrir proyecto preparado.
2. Desconectar red.
3. Operar durante varios minutos.
4. Reconectar.
5. Validar sincronización.

## Definition of Done

Una fase no está completa si:

- No compila.
- Tiene errores críticos de consola.
- Rompe funciones anteriores.
- No cumple criterios de aceptación.
- No actualiza documentación.

---

## Tooling Recomendado (Fase 4+)

- **Unit/Logic**: `Vitest` (Fast, Vite-native).
- **Components**: `Vitest` + `@testing-library/react`.
- **E2E**: `Playwright`.

## Estrategia de Minimización

1. **Lógica Pura**: Extraer reglas de negocio a funciones puras testeables sin DOM.
2. **Lazy Tooling**: No añadir runners hasta la Fase 4.
3. **Mocking**: Usar `msw` solo cuando la complejidad de red lo requiera.

## Fase 2 — Projects

La lógica pura y el repository temporal se prueban con `bun test`, disponible
sin instalar dependencias. Cubre validación, creación, renombrado, duplicación,
eliminación del proyecto activo, orden, búsqueda, persistencia y recuperación
ante datos locales inválidos.

Vitest, Testing Library y Playwright como dependencias del proyecto continúan
diferidos hasta que su alcance lo requiera. Las comprobaciones E2E de esta fase
usan únicamente el entorno de desarrollo.

## Fase 3 — Songs

`bun test` cubre el dominio (validación de título, labels automáticos no
destructivos, operaciones de secciones, duplicación con IDs nuevos, búsqueda)
y el repository temporal (CRUD, JSON inválido, formas corruptas, copias sin
referencias compartidas y propagación de errores de cuota). El autoguardado
(debounce, blur, flush) se verifica con comprobaciones E2E en el entorno de
desarrollo.

## Nota de Fase 0

Aún no hay runner de tests instalado. Vitest y Playwright se añaden en la
Fase 4, junto con los primeros tests del Presentation Engine. No se instalan
dependencias antes de que su fase las requiera.

## Fase 4 — Presentation Engine

`bun test` cubre el motor sin DOM ni navegador:

- **Runtime**: índices por item y slide, orden global navegable, items vacíos
  presentes en el índice pero fuera del recorrido, normalización de orden e
  ids duplicados descartados.
- **Presentación vacía**: load vacío, comandos no-op, selección inexistente.
- **Navegación**: dentro del item, entre items en ambos sentidos, extremos sin
  wrap, items sin slides saltados, selectores next/previous en bordes.
- **Items sin slides**: selección con slide `null`, `next`/`previous` buscando
  la slide más cercana en esa dirección y no-op cuando no existe.
- **Reemplazo y reset**: preservación de posición, caídas a item o primera
  slide, estado vacío, IDs inválidos.
- **Song → PresentationItem**: determinismo con el mismo `itemId`, ausencia de
  colisiones con `itemId` distinto, orden de secciones, secciones vacías
  omitidas y canción sin secciones.
- **Store**: notificación, `unsubscribe` e identidad de estado estable sin
  notificar cuando un comando no cambia nada.

## Fase 5 — Project Rundown / Composition

`bun test` cubre la composición sin DOM:

- **Rundown**: agregar al final, repetir la misma canción con ids de instancia
  distintos, mover con no-op en los extremos, eliminar solo esa instancia,
  normalización de `order` a 0..n-1 y duplicación con identidades nuevas.
- **Uso de una Song**: `findSongUsage` como regla pura sobre los projects.
- **Migración v1 → v2**: `rundown: []` por defecto, `itemIds` descartado, clave
  v1 conservada como respaldo, v2 leída sin volver a migrar, rundown inválido
  reparado, items inválidos descartados conservando los válidos, datos
  corruptos → estado vacío y persistencia de un rundown completo.
- **Rundown → PresentationItems**: orden, `itemId` de instancia, `sourceId` de
  origen, canción repetida sin colisiones de ids de slide, referencia rota como
  item sin slides y rundown vacío.

## Fase 6 — Live Mode

`bun test` cubre la operación sin DOM:

- **Program**: TAKE con y sin slide de Preview, TAKE fijando `content`, Preview
  que se mueve sin arrastrar Program, y marcas de slide/item al aire.
- **Modos de salida**: `clear` y `black` conservando `programSlideId`, vuelta a
  `content` recuperando la misma slide, toggle y no-op al repetir modo.
- **Load / Reload**: `loadPresentation` descartando Program siempre;
  `reloadPresentation` conservando Preview y Program cuando los ids persisten y
  anulándolos cuando desaparecen.
- **Snapshot**: composición del show, referencias rotas como items sin slides y
  firma de origen que detecta cambios de rundown y de canción.
- **Store**: TAKE y modos de salida a través del store, sin notificar cuando un
  comando no cambia nada.

## Fase 7 — Output Sync

- **Dominio** (`tests/output/output-snapshot.test.ts`): serialización y
  validación de mensajes; `snapshotsEqual` detecta mismo `slide.id` con
  `lines` distintas (editar Song + recargar publica update).
- **Publisher** (`tests/output/output-publisher.test.ts`): publica solo ante
  cambios visibles; responde `hello` con snapshot completo; `bye` al cerrar.
- **Subscriber** (`tests/output/output-subscriber.test.ts`): adopción del
  primer snapshot, descarte de mensajes fuera de orden, vinculación de sesión
  (ignora Live B mientras A vive; adopta B tras `bye` de A), timeout sin
  `bye` → salida segura, reconexión, `bye` de otra sesión ignorado, mensajes
  inválidos ignorados, múltiples subscribers.
- **Navegador** (Playwright): TAKE reflejado en Output, Preview no afecta,
  Clear/Black/Content, dos Outputs simultáneos, recarga de Output, Live
  ausente → negro puro, overlay de fullscreen y cursor oculto, 1920×1080,
  consola sin errores.

## Fase 7.1 — Navegación

- **Comportamiento** (`tests/routing/app-shell-providers.test.tsx`): monta el
  App Shell con `@happy-dom/global-registrator` y `react-dom/client`, simula
  Projects → Songs → Live → Projects y verifica un único montaje de
  `SongsProvider` y una única lectura inicial de cada almacén.
- **Contrato** (`tests/routing/route-provider-contract.test.ts`): el shell
  monta los providers, ningún layout hijo los remonta y el sidebar navega con
  `Link` del router.
- **Medición** (Playwright sobre el build de producción): navegación SPA sin
  peticiones de documento adicionales, sidebar no remontado, sin placeholders
  de carga entre secciones y consola limpia.

## Fase 8 — Presets

- **Dominio** (`tests/domain/preset-rules.test.ts`): creación y validación de
  nombre, duplicado independiente con nuevas fechas, protección del Default
  (renombrar/editar/eliminar lanzan), normalización de valores fuera de rango
  y de datos inválidos, comparación de estilos, orden y búsqueda.
- **Resolución y render** (`tests/domain/preset-resolution.test.ts`): fallback
  al Default sin id o con id inexistente, uso de un preset en rundowns,
  conversión a `cqh`/`cqw`, alineaciones a ejes flex y colores del preset.
- **Rundown** (`tests/domain/rundown-rules.test.ts`): la misma canción con
  presets distintos en dos apariciones; quitar el preset vuelve al Default.
- **Live** (`tests/features/live-presentation.test.ts`): el snapshot congela el
  estilo por aparición y la firma cambia al editar un Preset en uso, lo que
  dispara el aviso de contenido desactualizado.
- **Output** (`tests/output/output-snapshot.test.ts`): misma slide y mismo
  texto con estilo distinto producen update.
- **Persistencia** (`tests/services/local-storage-preset-repository.test.ts`):
  CRUD, datos corruptos ignorados, id reservado nunca persistido y estilo
  inválido normalizado.

## Fase 8.1 — Auto-advance de Program

- **Dominio** (`tests/domain/presentation-live.test.ts`): Next/Previous
  arrastran Program dentro del item al aire; `clear` y `black` conservan el
  modo mientras avanza `programSlideId`; cruzar de item (adelante y atrás)
  deja Program intacto; Preview en otro item, ausencia de Program, item vacío
  y referencia rota nunca auto-envían; TAKE mantiene su semántica y fuerza
  `content`; los límites globales devuelven la misma referencia de estado.
- **Store** (`tests/stores/presentation-store.test.ts`): `next()` auto-avanza
  dentro del item y se detiene al cruzar al siguiente.

## Fase 8.2 — Rediseño del espacio de trabajo Live

Verificación manual en navegador (la lógica no cambió, así que las pruebas
automatizadas de dominio y store siguen siendo la red de seguridad):

- Tres zonas visibles a la vez (rundown, rejilla de slides, Program + Preview)
  y barra de controles fija, sin scroll global en 1920×1080 y 1366×768.
- Selección de elemento en el rundown y rejilla del elemento seleccionado.
- Slide en Preview y slide en Program marcadas con color **y** etiqueta; una
  misma slide muestra `PROGRAM` y `PREVIEW` simultáneamente.
- Click en slide selecciona Preview sin alterar Program; TAKE envía al aire.
- Auto-advance dentro del item y parada al cruzar de item (TAKE requerido).
- Clear y Black conservan la slide y la recuperan al volver a Content.
- Elemento sin contenido: mensaje compacto, TAKE deshabilitado.
- Teclado (← → Enter) y foco visible; consola sin errores.
- `/output/main` sin regresiones: sigue reflejando Program.

## Fase 9 — Bible

- **Importación** (`tests/domain/bible-import.test.ts`): conversión al modelo
  canónico, versículos multilínea, descarte de HTML y metadata redundante,
  JSON inválido, formato desconocido, archivo sin versículos legibles, valores
  por defecto de metadata, números de versículo y `version_id` numéricos,
  `publisher`/`copyright` como objeto.
- **Referencias** (`tests/domain/bible-reference.test.ts`): abreviaturas,
  acentos, rangos, referencia inexistente, `buildPassage`, `verseRange`.
- **Pasaje → presentación** (`tests/domain/bible-passage-presentation.test.ts`):
  un versículo = una slide con `secondaryText`; el pasaje se clona al entrar al
  rundown; la conversión no usa `BibleRepository`; "contenido faltante" solo
  con payload ausente o corrupto; el preset del item se conserva.
- **Repositorio** (`tests/services/bible-repository.test.ts`): instalar,
  listar, leer por capítulo, reinstalar sin duplicar, eliminar por completo.

Verificación manual en navegador (1366×768 y 1440×900, consola limpia):
importar las Biblias reales NVI (27 MB) y RVR1960 (23 MB), navegar libro/capítulo/versículo, buscar
`jn 3:2-4`, previsualizar, agregar al Project, eliminar la traducción y
comprobar que el item sigue funcionando en el rundown, en Live (TAKE,
auto-advance) y en `/output/main` con la referencia secundaria visible.

## Fase 9.1 — Live Operator Workspace

- **`goLive`** (`tests/domain/presentation-live.test.ts`): desde `content`
  mueve Preview y Program; desde `clear` y desde `black` vuelve a `content`
  con la slide al aire; no-op con un id desconocido.
- **Alta incremental** (`tests/domain/presentation-append.test.ts`): el item se
  añade al final sin tocar Preview, Program ni `programMode`; los items
  existentes conservan su contenido congelado; la nueva slide queda navegable;
  con el show vacío sí posiciona Preview; id repetido es no-op.
- **Sesión de Live** (`tests/features/live-session.test.ts`): arranque sin
  desfase; detección de cambio externo; agregar contenido no genera falso
  aviso; un desfase previo se conserva tras agregar; la recarga explícita
  incorpora los cambios.
- **Búsqueda de biblioteca** (`tests/features/library-search.test.ts`): orden
  por título sin consulta, coincidencia por título y autor ignorando acentos,
  consulta sin resultados.

Verificación manual en navegador (1366×768 y 1920×1080, consola limpia):
enviar una canción al aire desde el dock; Black seguido de clic en una slide
devuelve el contenido a Output al instante; clic en un RundownItem no cambia
Program; "Rundown" agrega el item sin tocar Program ni Preview; `/` enfoca el
buscador del dock; escribir "black cosa" no dispara B ni C; Esc devuelve el
foco; B, C y Enter funcionan fuera del input; controles visibles y sin scroll
global en ambas resoluciones.


## Fase 9.2

- `tests/domain/presentation-remove.test.ts` — baja incremental, orden renormalizado,
  Program intacto al quitar otro item, snapshot congelado (líneas, `secondaryText`,
  estilo), equivalencia del `OutputSnapshot`, Clear/Black sobre la salida congelada,
  `goLive`/`take` la limpian y vuelven a `content` desde Clear y Black.
- `tests/features/bible-dock.test.ts` — selección y fallback de traducción, estado
  vacío y estados de la entrada de referencia (incompleta, inválida, válida, rango).
- `tests/features/live-session-remove.test.ts` — la baja adopta la firma nueva y
  conserva un desfase externo pendiente.
- Verificación en navegador con la NVI real importada: selector de traducción en
  Live, pasaje al aire desde el dock, quitar el item al aire sin cortar la salida,
  clic desde Black vuelve a contenido, 1366×768 y 1920×1080 sin scroll global.

## Fase 9.3 — Output sobre proyector

Automatizado: `tests/services/window-management.test.ts` (emparejado exacto, por
geometría, ambiguo y ausente; sugerencia automática con dos pantallas; preferencia
local incluida la lectura de datos corruptos) y
`tests/features/open-output-window.test.ts` (geometría del popup, reutilización de
`audience-main`, popup bloqueado, modo alternativo sin geometría, navegador que
prohíbe mover la ventana).

La API de pantallas múltiples no se puede ejercitar de verdad en un entorno
automatizado. Checklist manual en Windows con Chrome o Edge:

1. Un solo monitor: «Detectar pantallas» lista una; no hay sugerencia automática.
2. Notebook + proyector: se propone la pantalla no principal y se pide confirmar.
3. Tres monitores: no hay propuesta; el operador elige.
4. Permiso aceptado y permiso rechazado: en el rechazo se explica cómo habilitarlo.
5. Navegador sin la API: modo alternativo con la instrucción de mover la ventana.
6. Popup bloqueado: mensaje explícito para permitir ventanas emergentes.
7. Pantalla guardada ausente: «Proyector desconectado», sin abrir en la principal.
8. Proyector desconectado con la salida abierta: Program y la ventana no cambian.
9. Reabrir «Abrir Output»: reutiliza la misma ventana, no duplica.
10. Tecla F y doble clic en `/output/main`: entran en pantalla completa; Escape sale.
11. `/output/main?mode=test&n=2`: número, resolución y cierre, sin tocar Program.
12. Output y Program sincronizados tras todo lo anterior.
