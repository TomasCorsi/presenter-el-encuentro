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

## Tooling actual

- **Suite automatizada:** `bun test` (`bun:test`).
- **Componentes mínimos:** `react-dom` + `@happy-dom/global-registrator`.
- **Validación de tipos:** `npx tsc --noEmit`.
- **Lint/build:** scripts reales de `package.json` (`npm run lint`,
  `npm run build`).
- **Navegador:** checklist manual cuando la API nativa, codec, pantalla o
  permisos no pueden representarse fielmente en la suite.

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
- **Navegador** (checklist manual registrado): TAKE reflejado en Output, Preview no afecta,
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
- **Medición manual sobre el build de producción:** navegación SPA sin
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

## Fase 10 — Media

Cobertura automatizada:

- reglas, búsqueda, uso, Project → Presentation y bloqueo de baja al aire;
- importación compensable, rechazo de video sin OPFS y fallo de códec;
- playback puro con epoch ms, revisión, loop, apertura tardía y umbral de deriva;
- persistent storage concedido/denegado/ausente y no bloqueante;
- OPFS mediante handles falsos, caché/revocación de Blob URLs y bytes ausentes;
- representación mixta Song/Bible/Media en el rundown.

Quality Gate manual cerrado el 2026-09-24 por aceptación explícita del usuario:

- PASS: Chrome Windows, MP4 compatible, thumbnail/metadata, reload, cierre y
  reapertura del navegador, copia OPFS independiente del archivo original;
- PASS: estado `not-persistent` visible y la denegación no bloquea la
  importación;
- PASS: video en Live, Program muted y play/pause/restart/loop;
- no ejecutado por falta de archivo: MP4 con códec incompatible;
- no ejecutado: Output tardío/recargado/doble, audio de Output y activación,
  continuidad bajo Clear/Black, rundown mixto completo y bloqueo de baja al
  aire;
- revisión de consola parcial: `/media` y Live sin errores nuevos.

Las comprobaciones no ejecutadas no se consideran PASS. El usuario aceptó el
riesgo residual y dio por terminada la Fase 10. WEBM y el flujo PNG → Live →
Output ya habían sido validados en navegador.

## Fase 10.1 — Media Preview + Backgrounds Dinámicos

Quality Gate automatizado del 2026-09-25:

- `bun test`: 314 PASS, 0 FAIL, 743 assertions, 49 archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido: 0 errores; queda el warning preexistente de Fast Refresh en
  `projects-context.tsx`; la regla global Prettier/CRLF se excluyó para no
  reformatear masivamente el repositorio;
- `npm run build`: PASS (client, SSR y Nitro/Cloudflare).

Cobertura nueva: persistencia y saneamiento de `RundownItem.background`,
resolución/fallback del Preset, uso y delete protection, target Preview-first,
favoritos/MRU, replace incremental preservando estado, snapshot Output
retrocompatible, video decorativo y preview local con reset al cerrar.

Pendiente manual en Chrome/Edge Windows: preview visual de image/video y sus
controles; selectores Song/Bible; equivalencia Program/Output; Output tardío y
reload; Cut/Fade visual limitado al fondo; error real de decode; consola limpia.
El entorno automatizado de cierre no expuso ningún navegador, por lo que estos
puntos no se registran como PASS.

### Ajuste: visual slide thumbnails

Gate automatizado del 2026-09-25:

- `bun test`: 323 PASS, 0 FAIL, 780 assertions, 51 archivos;
- `npx tsc --noEmit`: PASS;
- tests dirigidos de thumbnail/BackgroundLayer: PASS;
- lint normal sobre archivos nuevos: PASS; lint sobre todos los archivos del
  ajuste con la regla global Prettier/CRLF excluida: PASS, 0 errores;
- `npm run build`: PASS (client, SSR y Nitro/Cloudflare).

Cobertura: Song solid/image/video-thumbnail, Bible con referencia secundaria,
estilo y safe area compartidos, fallback por metadata ausente o error de carga,
Preview/Program fuera de la superficie, click `goLive`, cards Media sin cambios,
cero `<video>` y cero lecturas/getUrl del storage desde la grilla.

Pendiente manual: fluidez del scroll con un item de muchas slides, legibilidad
en el ancho mínimo de card y contraste de los indicadores Preview/Program. El
entorno de cierre no expuso apps ni browsers, por lo que no se registra PASS
visual para este ajuste.

## Fase 10.2 — Operator Workspace

Quality Gate final del 2026-10-03:

- `npx --yes bun test` con Bun 1.4.2: 356 PASS, 0 FAIL, 893 assertions y 58
  archivos;
- `npx tsc --noEmit`: PASS;
- `npm run build`: PASS para client, SSR y Nitro/Cloudflare;
- lint dirigido sobre los archivos de la fase: 0 errores y un warning
  preexistente de Fast Refresh en `projects-context.tsx`; la regla global
  Prettier/CRLF se excluyó para evitar un reformateo masivo;
- Prettier check de los archivos nuevos: PASS.

Cobertura verificada:

- clic simple cambia Preview sin cambiar Program;
- doble clic, Enter y Space seleccionan y ejecutan TAKE sobre la slide correcta,
  sin publicar por error la selección anterior;
- TAKE global usa el Preview actual; Previous/Next, Clear y Black conservan su
  semántica;
- Preview y Program pueden ser distintos o coincidir, y preparar Preview no
  publica Output;
- el reordenamiento incremental mantiene orden e IDs, Preview, Program,
  `programMode`, `detachedProgramSlide`, playback de video y `staleExternal`,
  sin absorber cambios externos ni modificar el Output si Program no cambia;
- helpers responsive para 1366×768, 1920×855, 1600×900 y 1920×1080;
- preferencias, resize y bounds del Library Dock, fullscreen y Slide Strip
  horizontal con thumbnails visuales sin videos ni lecturas de bytes.

Única regresión encontrada durante el gate: el test de `LivePreviewMonitor` no
proveía el `MediaProvider` requerido por el componente real. Se corrigió sólo
el harness del test con repositorio y storage en memoria; no fue necesario
cambiar código de producción. La suite emite warnings preexistentes de React
`act(...)` en `app-shell-providers.test.tsx`, pero ese test y la suite completa
pasan.

**Estado:** Fase 10.2 — Operator Workspace COMPLETADA (2026-10-03).

## Fase 10.3 — Media Library organizada

Gate final del 2026-10-08:

- `npx --yes bun test` con Bun 1.4.2: 370 PASS, 0 FAIL, 923 assertions y 63
  archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido sobre los archivos modificados y nuevos: 0 errores y 3 warnings
  de Fast Refresh en `media-context.tsx`; la regla global Prettier/CRLF se
  excluyó para no reformatear masivamente el repositorio;
- `npm run build`: PASS para client, SSR y Nitro/Cloudflare. Solo se emitieron
  warnings no bloqueantes de configuración de Vite/Rollup.
- Chrome 153 headless real, con perfil temporal aislado: migración IndexedDB
  v1→v2, OPFS, `/media`, Live Dock, Background Deck y responsive verificados.

Cobertura agregada o extendida:

- migración lógica de assets antiguos, normalización de tags, consulta combinada,
  filtros y orden MRU;
- migración/saneamiento de favoritos, recientes y densidad;
- CRUD y unicidad de colecciones, desasignación y cambios de organización sin
  modificar `presentationUpdatedAt`;
- firma de Live inmune a colección/tags y sensible a cambios presentacionales;
- usos detallados de contenido y backgrounds Song/Bible;
- delete bulk bloqueado completamente por referencias y reporte de completados/
  fallidos después de un error físico;
- cards Media sin `<video>` ni apertura de bytes;
- regresión completa de Presentation, Live, Output, backgrounds y storage.

Durante el gate se estabilizó el harness de
`tests/routing/app-shell-providers.test.tsx`: la instrumentación ahora pertenece
a la instancia concreta de `localStorage`, no a su prototipo global, y espera el
estado observable de los providers. No fue necesario cambiar código productivo
por esa regresión de test.

Validación real en navegador:

- una base v1 con 302 assets abrió como v2 sin reimportar; `assets` y bytes OPFS
  se conservaron, apareció `collections` y los campos nuevos se normalizaron;
- drag & drop real de PNG, JPEG, WEBP, MP4 y WEBM dentro de una colección;
- inspector de imagen/video, storage, usos, rename, tags y favoritos;
- 307 cards, cero `<video>` en la grilla, consola sin errores y responsive en
  1366×768, 1600×900 y 1920×1080;
- bulk tags/favoritos y delete all-or-nothing por referencias;
- eliminar una colección conserva y desasigna sus assets;
- Preview no modifica recientes; importación, `+ Rundown`, `Al aire` y fondo sí;
- Media Dock y Background Deck comparten favoritos/recientes y mantienen el
  flujo Preview-first.

El fallo físico posterior al preflight de borrado se cubre mediante test de
servicio determinista (completados/fallidos); no se corrompió OPFS para simularlo
manualmente. Pendiente funcional detectado: los tags aceptan y normalizan texto
libre, pero no existe UI de autocompletado. Por la restricción de no agregar
features durante el gate, no se agregó. El 2026-10-13 este punto se reclasificó
explícitamente como pendiente no bloqueante y la Fase 10.3 quedó COMPLETADA.

## Fase 11.1 — Stage Display

Quality Gate automático final del 2026-10-13:

- `bun test` global no estuvo disponible; `npx --yes bun test` con Bun 1.4.3:
  388 PASS, 0 FAIL, 985 assertions y 67 archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido sobre los `.ts/.tsx` modificados: 0 errores y 3 warnings ya
  conocidos de Fast Refresh en `media-context.tsx`; Prettier/CRLF se excluyó
  para evitar un formateo masivo;
- `git diff --check`: PASS;
- `npm run build`: PASS para client, SSR y Nitro con preset
  `cloudflare-module` y compatibilidad `2026-10-08`. `/output/stage` está
  presente en los artefactos client y SSR. Los avisos de plugin timings,
  `vite-tsconfig-paths` e `inlineDynamicImports` son no bloqueantes.

Cobertura nueva o extendida:

- current deriva de Program y nunca Preview; next permanece en el mismo item o
  cruza items vacíos hasta la siguiente slide navegable;
- show vacío, fin de show, Clear/Black y Program detached;
- cues Song, Bible y Media sin estilos, playback, bytes ni video;
- snapshots legacy sin `stage`, descarte seguro de proyección inválida e igualdad
  sensible a cambios relevantes de Stage;
- publisher late-open/hello con session y sequence, deduplicación de cambios de
  Preview y publicación cuando cambia next;
- retención del último snapshot durante stale, reloj con timers controlados y
  ruta Stage estructuralmente read-only;
- regresión de Main en Content/Clear/Black y aislamiento/reutilización de las
  ventanas Main/Stage.

No se realizó validación manual durante este cierre. Quedan pendientes Live con
Main y Stage, Song, Bible, Media, Clear/Black, late-open, reload,
stale/reconexión, fullscreen, popup blocking y las resoluciones objetivo.

**Estado:** Fase 11.1 IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO /
VALIDACIÓN MANUAL PENDIENTE. Al momento de ese cierre, Fase 11.2 no estaba
iniciada.

## Fase 11.2 — Stream Output transparente

Quality Gate automático final del 2026-10-16:

- `npx --yes bun test` con Bun 1.4.3: 400 PASS, 0 FAIL, 1069 assertions y 74
  archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido sobre los archivos nuevos y modificados de Stream: PASS, sin
  errores; la regla global Prettier/CRLF se excluyó para evitar un formateo
  masivo del repositorio;
- `git diff --check`: PASS;
- `npm run build`: PASS para client, SSR y Nitro con preset
  `cloudflare-module`, compatibilidad `2026-10-13` y Nitro
  `3.0.260603-beta`;
- los artefactos incluyen `/output/main`, `/output/stage`, `/output/stream` y
  `/api/output-relay`;
- el endpoint SSE, sus headers y el hub en memoria quedaron exclusivamente en
  el bundle servidor. Los assets públicos sólo contienen el transporte cliente
  EventSource/fetch y no contienen la implementación server-only;
- el build no emitió errores de SSE, EventSource ni APIs `Request`/`Response`.
  Los avisos de timings, `vite-tsconfig-paths` e `inlineDynamicImports` son no
  bloqueantes.

Cobertura nueva o extendida:

- superficie SSR y DOM con fondo transparente, lower third Song/Bible y
  referencia mediante `secondaryText`;
- Media, Clear, Black, ausencia de sesión y stale dejan la salida vacía;
- backgrounds, transiciones, OPFS, MediaProvider, playback y chrome de
  fullscreen quedan fuera de Stream;
- ruta estructuralmente read-only y fuera del App Shell;
- relay local limitado a loopback, validación de origin, límite de 256 KiB,
  exclusión del emisor y limpieza de conexiones SSE;
- transporte compuesto con aislamiento de fallos del relay respecto de
  BroadcastChannel;
- integración de `hello`, late-open, sesión, secuencia, actualización y `bye`
  por relay, manteniendo Main en BroadcastChannel;
- ventanas Main, Stage y Stream con nombres independientes.

Durante el gate, dos pruebas del endpoint fallaron porque Happy DOM sustituía
globalmente `Request` y descartaba headers construidos por el test. Se corrigió
únicamente el harness con requests deterministas; no fue necesario cambiar el
endpoint productivo. También se agregó una regresión integrada que demuestra el
late-open de Stream sin degradar Main.

Pendiente manual: validar alpha real y reconexión en OBS Browser Source y vMix
Web Browser Input a 1920×1080 y 1280×720, incluyendo late-open, reload y caída/
reinicio del servidor local. Window Capture de Chrome/Edge no es un modo alpha
soportado.

**Estado:** Fase 11.2 IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO /
BUILD PASS / VALIDACIÓN MANUAL OBS/VMIX PENDIENTE. La fase siguiente no fue
iniciada.

## Fase 12 — PWA + Offline

Quality Gate automático final del 2026-11-03:

- tests focalizados de IndexedDB, migración, caché PWA, Storage API y contrato
  de providers: 28 PASS, 0 FAIL y 112 assertions en 5 archivos;
- suite completa con Bun 1.4.4 vía `npx`: 414 PASS, 0 FAIL, 1148 assertions y
  76 archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido: PASS, 0 errores y 8 warnings conocidos de Fast Refresh en
  archivos Context; la regla Prettier/CRLF se excluyó para evitar reformateo
  masivo;
- `git diff --check`: PASS;
- `npm run build`: PASS para client, SSR y Nitro con preset
  `cloudflare-module`, compatibilidad `2026-10-29`;
- el artefacto público contiene `manifest.webmanifest`, los cuatro iconos PWA y
  `sw.js`; Workbox inyectó 115 entradas (975,71 KiB), incluidos chunks hashed,
  rutas críticas y recursos esenciales;
- el precache no contiene `/api`, `/api/output-relay` ni `/_serverFn`; el hub
  del relay permanece sólo en el bundle servidor;
- validación manual de navegador: no ejecutada.

Cobertura añadida:

- creación de `broadcast-control.app` con stores Projects, Songs, Presets y
  meta, sin incluir Bible ni Media;
- CRUD de los tres repositories y coherencia transaccional de
  `activeProjectId`;
- migración de los tres dominios, fallback Projects v1, payload corrupto,
  transacción abortada, marcador atómico, merge por `updatedAt`, empate a favor
  de IndexedDB, idempotencia y conservación byte a byte de las claves legacy;
- estado degradado que rechaza escrituras cuando la fuente legacy es corrupta;
- política Network Only para relay, APIs, server functions, métodos mutables,
  recursos cross-origin y `blob:`;
- manifest, iconos, registro client-only, worker waiting, cleanup de caches,
  bloqueo de ventanas Live/Main/Stage/Stream y ausencia de migraciones dentro
  del worker;
- regresión completa de Projects, Songs, Presets, Media usages, Bible, Live,
  Main, Stage, Stream, BroadcastChannel y relay.

Durante el gate pre-build, el test arquitectónico de providers todavía buscaba
los tags sin props anteriores a Fase 12. Se actualizó para verificar el
bootstrap único y la inyección explícita de repositories. No se modificó
comportamiento operativo.

El primer build real detectó dos errores acotados al empaquetado PWA. Workbox no
podía inyectar el manifest porque el marcador no aparecía literalmente como
`self.__WB_MANIFEST`; después, el worker se generaba en el `dist` predeterminado
en vez del directorio público de Nitro. Se corrigieron el marcador y el `outDir`
oficial de `vite-plugin-pwa`. El build repetido generó el worker publicable y el
precache completo; no fue necesario cambiar la arquitectura ni la política de
caché.

Pendiente manual: migración real desde perfiles con datos legacy, instalación
Chrome/Edge, arranque y reload offline, Main/Stage offline, Stream transparente
sin relay, persistencia/cuota y actualización con ventanas operativas.

**Estado:** Fase 12 IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO /
BUILD PASS / VALIDACIÓN MANUAL PENDIENTE.

La validación manual pendiente de Fase 12 fue aceptada temporalmente como riesgo
conocido para permitir la implementación de Fase 13. No se la registra como PASS.

## Fase 13 — Supabase opcional

Cobertura creada:

- configuración ausente/válida/inválida y cliente browser-only;
- CloudProvider SSR-safe y no bloqueante;
- signup, login, logout, recovery, sesión expirada y workspace bootstrap;
- logout sin modificar almacenamiento local;
- mappers Project/Song/Preset, límites y payloads versionados;
- repositories ligados a un workspace y upsert compuesto;
- contrato sin imports cloud en providers operativos ni Outputs;
- Supabase Auth/REST/Realtime/Storage como Network Only;
- migración SQL con RLS, grants, RPC, auditoría y constraints;
- pgTAP de aislamiento same/cross-workspace y roles.

El pgTAP puede ejecutarse contra Supabase real mediante el MCP oficial; no
requiere Docker si existe acceso SQL remoto autenticado.

Supabase cloud sync no es backup. La confirmación/recovery real requiere SMTP
productivo. Media continúa completamente local.

Resultados finales del 2026-11-04:

- proyecto remoto verificado: `yadwnoqjexrrtklhfgcq`;
- migración `phase13_cloud_foundation`: PASS;
- tablas `profiles`, `workspaces`, `workspace_members`, `projects`, `songs` y
  `presets`: PASS, todas con RLS;
- catálogo: schema `private`, 17 policies, 8 triggers y 14 índices verificados;
- funciones `SECURITY DEFINER` con `search_path=''`; helpers y triggers sin
  ejecución pública/anon; grants mínimos verificados;
- anon read/write: bloqueado con `42501` usando publishable key;
- dos usuarios independientes: profile, workspace personal y membership owner;
  segunda llamada al RPC devolvió el mismo workspace sin duplicados;
- RLS real A/B: lectura, listado, update y delete cross-workspace bloqueados;
- owner actualizó metadata; operator leyó contenido de su workspace pero no
  pudo administrar metadata ni memberships;
- Projects/Songs/Presets reales: `put/get/list/delete`, mapping, `schemaVersion`,
  timestamps, workspace binding y errores normalizados: PASS;
- identidad de entidades y auditoría protegidas con `22023`; constraints de
  nombre/payload rechazaron con `23514`; `updated_by` y `cloud_updated_at`: PASS;
- Auth login/logout, persistencia, refresh y reconnect: PASS;
- signup real llegó a Auth pero no completó por rate limit de email; email
  confirmation está activa; recovery end-to-end quedó pendiente por el mismo
  `429 over_email_send_rate_limit`; SMTP productivo no fue validado;
- pgTAP remoto: 15/15 PASS. Se corrigieron dos aserciones del harness: un UPDATE
  ocultado por RLS modifica cero filas sin lanzar, y `updated_by` pertenece al
  último editor (operator), no al owner que ejecuta la aserción después;
- focalizados cloud/Auth/PWA: 20 PASS, 0 FAIL, 102 assertions, 5 archivos;
- suite completa: 428 PASS, 0 FAIL, 1212 assertions, 80 archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido: PASS, 0 errores y 1 warning conocido de Fast Refresh;
- `git diff --check`: PASS;
- build client, SSR, PWA y Nitro `cloudflare-module` con compatibilidad
  `2026-10-30`: PASS;
- inspección de artefactos: sin secret keys, service-role, passwords ni
  credenciales administrativas embebidas; URL y publishable key son las únicas
  variables client permitidas;
- `.env.local` continúa ignorado y no existe en el worktree;
- los usuarios, workspaces y contenido QA se eliminaron al terminar; conteos
  finales de las seis entidades de prueba: cero;
- advisor: el acceso `authenticated` al RPC `SECURITY DEFINER` es intencional;
  leaked-password protection está desactivado y queda como recomendación.

IndexedDB continúa como autoridad operativa. No hubo import, download, merge,
sync, dual-write ni cambio del `workspaceId` local; repositories cloud no están
conectados a la UI operativa.

**Estado:** FASE 13 COMPLETADA / MIGRACIÓN CLOUD PASS / RLS REAL PASS / pgTAP
15/15 PASS / REPOSITORIES CLOUD PASS / AUTH BÁSICA REAL PASS / BUILD PASS /
RECOVERY END-TO-END Y SMTP PRODUCTIVO PENDIENTES NO BLOQUEANTES.

## Fase 14 — Sync Engine

Cobertura local: upgrade IndexedDB v1→v2, stores/índices, preservación de
entidades y `activeProjectId`, journal atómico con abort de entidad si falla el
enqueue, cola durable tras reapertura, coalescing, generation safety, leases,
remote apply sin reenqueue, checkpoints, archive y relink fresco. Reglas puras
cubren fingerprint canónico, backoff/jitter, `Retry-After` y límite de intentos.
El engine prueba el orden pull→flush→pull, offline sin incrementar intentos,
respuesta perdida idempotente y conflicto CAS. La suite local cubre
explícitamente update/update, update/delete, delete/update, colisión inicial,
mantener local, usar cloud y duplicar copia local. Tests estáticos impiden
imports Supabase/gateway desde features operativas.

Validación real del 2026-11-05 en `yadwnoqjexrrtklhfgcq`:

- migración `phase14_sync_engine`: PASS;
- pgTAP remoto: 25/25 PASS;
- QA SQL transaccional: insert, idempotencia tras respuesta perdida, CAS,
  tombstone, pull incremental, restore, DELETE físico revocado, RLS
  cross-workspace y `SECURITY INVOKER`: PASS;
- cleanup: `ROLLBACK`, cero usuarios/contenido QA;
- advisor de seguridad: sólo permanece el warning intencional heredado de
  `ensure_personal_workspace()` SECURITY DEFINER; el RPC sync no aparece;
- advisor de performance: índices sync recién creados aún sin uso estadístico y
  foreign-key indexes heredados como recomendaciones no bloqueantes.

Quality gate automático final del 2026-11-05:

- build client: PASS, Vite 8.1.5 y 2253 módulos;
- build SSR: PASS, 293 módulos;
- Nitro: PASS, preset `cloudflare-module`, compatibilidad `2026-10-31`;
- PWA: PASS, `injectManifest`, `sw.js` y 118 entradas precache (1287,33 KiB);
- artefactos: `SyncProvider` permanece bajo App Shell; Main, Stage y Stream no
  incluyen provider, gateway, Supabase ni stores sync; Supabase sigue Network
  Only y el Service Worker no cachea requests sync;
- focalizados Sync/Cloud/IndexedDB: 39 PASS, 0 FAIL, 281 assertions;
- suite completa: 445 PASS, 0 FAIL, 1396 assertions en 84 archivos;
- `npx tsc --noEmit`: PASS;
- lint dirigido: PASS, 0 errores y 6 warnings Fast Refresh conocidos por el
  patrón Provider+hook;
- `git diff --check`: PASS.

El cierre detectó y corrigió un bug real y acotado: una excepción síncrona del
journal podía dejar confirmar la entidad sin su entrada de queue. Los tres
repositories IndexedDB ahora abortan explícitamente la misma transacción y el
test de regresión confirma que no queda entidad ni queue parcial.

No se repitió QA SQL destructivo porque no hubo cambios SQL. Se conserva la
evidencia ya validada de migración cloud, pgTAP 25/25, CAS, tombstones, restore,
pull incremental, aislamiento cross-workspace, grants y cleanup completo.

QA manual pendiente: dos browsers/perfiles o dispositivos reales, edición
offline/reconnect, conflictos UI, logout/relink, Live activo con cambio remoto y
resume real de PWA. No se realizó QA manual ni se creó commit.

**Estado:** IMPLEMENTACIÓN COMPLETA / CLOUD MIGRATION PASS / pgTAP 25/25 PASS /
QUALITY GATE AUTOMÁTICO COMPLETO / BUILD PASS / QA MANUAL DOS DISPOSITIVOS
PENDIENTE.
