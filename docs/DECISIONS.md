# Architecture Decisions

## ADR-001 — Local-first

### Contexto

La aplicación será utilizada durante eventos en vivo y no puede depender de Internet.

### Decisión

Las funciones críticas operarán desde almacenamiento local.

### Motivo

Evitar interrupciones por pérdida de conectividad.

### Consecuencias

Será necesario implementar persistencia y sincronización.

---

## ADR-002 — Supabase como backend cloud

### Contexto

Se necesita autenticación, base de datos, storage y sincronización.

### Decisión

Usar Supabase.

### Motivo

Reduce complejidad operativa y se integra bien con aplicaciones web modernas.

### Consecuencias

Se deberá implementar RLS y separar cloud de runtime Live.

---

## ADR-003 — IndexedDB para persistencia local

### Contexto

La aplicación será PWA y debe guardar datos offline.

### Decisión

Usar IndexedDB mediante una capa de repositorio.

### Motivo

Es el almacenamiento persistente adecuado para aplicaciones web complejas.

### Consecuencias

No acceder directamente a IndexedDB desde componentes.

---

## ADR-004 — Presentation Engine desacoplado

### Contexto

La misma presentación debe alimentar varios outputs.

### Decisión

Crear un motor central independiente del UI.

### Motivo

Permite Main, Stage, Stream y Remote sin duplicar lógica.

### Consecuencias

Las vistas deben consumir un estado compartido.

---

## ADR-005 — PWA antes que desktop nativo

### Contexto

Se busca facilidad de desarrollo, instalación desde URL y compatibilidad multiplataforma.

### Decisión

Construir primero como PWA.

### Motivo

Menor complejidad y despliegue sencillo.

### Consecuencias

Funciones nativas como NDI, DeckLink o SDI quedan fuera del MVP.

---

## ADR-006 — Desarrollo por fases

### Contexto

El proyecto tiene alcance amplio.

### Decisión

Desarrollar y validar fase por fase.

### Motivo

Reducir retrabajo, bugs y consumo innecesario de créditos.

### Consecuencias

No se avanza a la siguiente fase sin aprobación.

---

## ADR-007 — Enrutado por archivos de TanStack Start

### Contexto

La documentación inicial proponía `src/app/` y `src/pages/`, que no corresponden
al stack real del proyecto.

### Decisión

Usar el enrutado por archivos de TanStack Start en `src/routes/`.

### Motivo

Es el enrutado nativo del stack; evita capas propias innecesarias y habilita
code splitting y SSR sin configuración extra.

### Consecuencias

`src/routeTree.gen.ts` es generado y no se edita. Los outputs se definen como
rutas independientes (`output.main.tsx`, etc.).

---

## ADR-008 — Estado global diferido a la Fase 4

### Contexto

Los documentos mencionan Zustand o equivalente.

### Decisión

No instalar ninguna librería de estado global hasta la Fase 4, cuando el
Presentation Engine lo requiera realmente.

### Motivo

Evitar sobreingeniería y dependencias sin uso.

### Consecuencias

Las Fases 1–3 usan estado local de componente y el estado de servidor que
provee el stack.

---

## ADR-009 — Tokens semánticos como única fuente de color

### Contexto

El design system define tokens conceptuales (`surface`, `live`, `offline`...).

### Decisión

Todos los colores se definen como tokens semánticos en `src/styles.css` y se
consumen mediante clases semánticas. Prohibido usar colores literales en los
componentes.

### Motivo

Coherencia visual, tema oscuro consistente y cambios centralizados.

### Consecuencias

Añadir un color implica registrar el token antes de usarlo.

---

## ADR-010 — BroadcastChannel: decisión PROVISIONAL

### Contexto

Los outputs (Main, Stage, Stream) se abren como ventanas o pestañas separadas y
necesitan recibir el estado de presentación.

### Decisión

Provisional: usar BroadcastChannel para sincronizar ventanas y pestañas del
MISMO dispositivo.

Esta decisión NO es definitiva y queda pendiente de validación técnica en la
Fase 6.

### Motivo

Es la vía más simple y de menor latencia dentro de un mismo navegador, sin
dependencias ni red.

### Consecuencias

- No sirve para dispositivos distintos.
- El Mobile Remote (Fase 15) y cualquier control entre dispositivos requerirán
  otro canal, que se definirá en una fase posterior.
- El transporte debe quedar aislado tras una interfaz, para poder sustituirlo
  sin tocar el Presentation Engine ni los outputs.
- Solo puede instanciarse en cliente (ver regla SSR en ARCHITECTURE.md).

---

## ADR-011 — Persistencia temporal de Projects y estado compartido

### Contexto

Fase 2 necesita CRUD real y conservar el proyecto activo tras recargas, pero
IndexedDB y sincronización todavía están fuera de alcance.

### Decisión

Usar temporalmente `localStorage` detrás de un `ProjectRepository` asíncrono.
Compartir su snapshot mediante un Context de React limitado a Projects, sin
añadir una librería de estado ni utilizar el store del Presentation Engine.

El repository contiene únicamente persistencia. La duplicación y las demás
reglas de negocio permanecen en dominio/servicio.

### Consecuencias

- La UI no accede directamente al almacenamiento.
- El adaptador solo se crea y lee en cliente para mantener compatibilidad SSR.
- `activeProjectId` es local al workspace/dispositivo y no está sincronizado.
- La decisión sobre sincronizarlo o mantenerlo por dispositivo queda pendiente.
- Los datos temporales no garantizan migración automática a IndexedDB.

---

## ADR-012 — Secciones de Song embebidas y tipos de sección

### Contexto

Fase 3 necesita letra estructurada por secciones con persistencia local
temporal. El modelo previo referenciaba secciones por `sectionIds` y usaba
tipos `ending`/`custom` sin `prechorus`/`outro`.

### Decisión

Las secciones viven embebidas en `Song` (`sections: SongSection[]`), sin
colección separada ni `songId`. Tipos: `verse`, `chorus`, `prechorus`,
`bridge`, `intro`, `outro`, `custom`. Los campos opcionales (`tags`,
`favorite`, `presetId`, copyright) quedan diferidos.

Labels automáticos: `Verso N` (numerados según versos existentes), `Coro`,
`Pre-coro`, `Puente`, `Intro`, `Outro`; en `custom` el usuario define el
label. Reordenar solo cambia `order` (normalizado a 0..n-1), nunca labels.
Cambiar el tipo solo sugiere un nuevo label si el anterior era automático.

### Consecuencias

- Una canción es una unidad de persistencia: lecturas y escrituras simples.
- La migración futura a IndexedDB conservará esta forma embebida.

---

## ADR-013 — Autoguardado del editor de Songs

### Contexto

El editor de secciones genera muchas escrituras pequeñas; un guardado manual
sería frágil y un guardado por pulsación, innecesario.

### Decisión

Autoguardado con debounce de ~600 ms sobre un borrador local del editor:

- Las ediciones se aplican de inmediato al borrador y se marcan `dirty`.
- Al hacer blur de un campo se intenta guardar de inmediato si hay cambios.
- Antes de acciones que cambian de contexto (duplicar, eliminar) se hace
  flush de los cambios pendientes.
- Desmontar el componente NO es garantía de persistencia.
- Si el guardado falla, el borrador se conserva y se muestra
  `Error al guardar`; `Guardado hh:mm` solo aparece tras la confirmación
  del repository.
- No existe Undo, historial ni versionado: los cambios no son reversibles.

Estados visibles: `Guardando…`, `Guardado hh:mm`, `Cambios sin guardar`,
`Error al guardar`.

### Consecuencias

- localStorage tiene capacidad limitada y dependiente del navegador/entorno;
  el volumen esperado es pequeño temporalmente y los errores de cuota son
  errores reales de persistencia que se muestran al usuario.
- IndexedDB será la solución definitiva en su fase (Fase 11).

---

## ADR-014 — Presentation Engine como dominio puro

### Contexto

El motor debe alimentar Live, Outputs, Stage, Stream y Remote sin que la
lógica de presentación se reparta entre componentes React.

### Decisión

- Comandos puros `(state, ...) => state`: `load`, `reset`, `selectItem`,
  `selectSlide`, `next`, `previous`, `goToFirst`, `goToLast`.
- Índices derivados explícitos mediante `buildPresentationRuntime(items)`,
  construidos solo cuando cambia la presentación. No hay caches mutables
  ocultos dentro del motor.
- Única fuente de verdad posicional: `currentItemId` + `currentSlideId`.
  Los índices, `currentItem`, `currentSlide`, `nextSlide` y `previousSlide`
  son selectores derivados, nunca estado almacenado.
- Sin `window`, `document`, `localStorage` ni `BroadcastChannel`.

### Semántica de items sin slides

1. `currentItemId` puede apuntar a un item válido aunque no tenga slides.
2. `currentSlideId` es `null` cuando ese item no tiene slides.
3. Si `currentSlideId !== null`, pertenece siempre a `currentItemId`.

Desde un item vacío, `next()` busca la primera slide navegable posterior y
`previous()` la última anterior. Si no existe, es no-op. Durante la
navegación normal los items sin slides se saltan.

### Límites

`next()` en la última slide navegable y `previous()` en la primera son
no-ops: sin wrap y sin excepción. Los IDs inexistentes devuelven la misma
referencia de estado, nunca un error ni una referencia imposible.

---

## ADR-015 — Store vanilla en lugar de Zustand

### Contexto

ADR-008 difirió la elección de librería de estado hasta esta fase.

### Decisión

Store propio framework-agnóstico (`getState`, `subscribe`, comandos) sobre el
dominio puro. En React se consume con `useSyncExternalStore`, con
`getServerSnapshot` explícito para SSR en TanStack Start.

### Motivo

Zustand aportaría prácticamente lo mismo que unas pocas líneas propias,
mientras que la independencia del dominio respecto de React ya obliga a
separar dominio y store. Context + reducer ataría el estado al árbol de
React, y las ventanas de output no comparten árbol.

### Consecuencias

- Cero dependencias nuevas.
- El store permite suscripciones dentro de UN mismo runtime JS.
- NO sincroniza por sí mismo ventanas distintas; la sincronización entre
  ventanas llegará por otro mecanismo en su fase (ver ADR-010).

---

## ADR-016 — Slides de runtime derivadas e identidad de instancia

### Decisión

- Las slides no se persisten en la Fase 4: se derivan de la Song mediante
  una transformación pura y determinista.
- `PresentationItem.id` es la identidad de ESA instancia dentro de una
  presentación; `sourceId` es la identidad de la entidad original.
- IDs de slide: `${itemId}:${sectionId}:${chunkIndex}`.

### Motivo

Una misma canción puede repetirse dentro de un mismo rundown (A, B, A). La
separación evita colisiones y mantiene los IDs estables mientras se use el
mismo `itemId`.

### Consecuencias

- El item de runtime lleva `slides` embebidas en lugar de `slideIds`:
  divergencia consciente respecto al modelo persistido.
- División versión 1: una sección = una slide. Dividir por líneas o altura
  requiere tipografía y tamaño de output (Presets, Fase 7).

---

## ADR-017 — Nomenclatura neutral y Preview/Program pospuesto

### Contexto

Más adelante hará falta seleccionar una slide en Preview y enviarla a
Program, pero hoy no existe ningún consumidor de esa separación.

### Decisión

Una sola posición (`currentSlideId`) y selectores con nombres neutrales:
`getCurrentItem()` y `getCurrentSlide()`. No se usa todavía nomenclatura
`program*`.

### Motivo

El estado actual no representa Program; nombrarlo así hoy introduciría
semántica falsa. Un rename controlado en la Fase 6 es preferible.

### Consecuencias

Cerrada en la Fase 6: `getCurrentItem()` / `getCurrentSlide()` pasaron a
`getPreviewItem()` / `getPreviewSlide()` y se añadieron los selectores de
Program (ADR-022). `logo` sigue fuera hasta Presets/Media.


---

## ADR-018 — Rundown embebido en Project

### Contexto

El Project necesita una secuencia real y ordenada de contenido. El modelo
tenía `itemIds: string[]`, un placeholder nunca utilizado.

### Decisión

`rundown: RundownItem[]` vive embebido dentro de `Project`. `itemIds` se
elimina del modelo.

### Motivo

Coherencia con las secciones embebidas de Song (ADR-012); el rundown no tiene
vida fuera de su project; duplicar un Project duplica su rundown sin joins;
reordenar es una única escritura atómica. Mantener dos listas de orden
(`itemIds` y `rundown`) garantizaría desincronización.

### Consecuencias

- `RundownItem.id` es identidad de instancia y `sourceId` identidad de origen:
  la misma canción puede repetirse sin colisiones.
- Duplicar un Project genera nuevas identidades de instancia conservando
  `sourceId`.
- `order` se normaliza siempre a 0..n-1, también al leer de disco.

---

## ADR-019 — Migración versionada de la clave de Projects

### Decisión

La clave sube a `broadcast-control.projects.v2`. Si solo existe `v1`, se migra
en memoria (cada Project recibe `rundown: []`, se descarta `itemIds`) y el
resultado se escribe en `v2`. La clave `v1` **no se borra**: queda como
respaldo hasta que una fase posterior la limpie.

### Consecuencias

- Ningún proyecto existente se pierde ni se borra silenciosamente.
- La validación es defensiva y no destructiva a nivel de lista: un `rundown`
  ausente o inválido pasa a `[]`, y los items inválidos individuales se
  descartan conservando los válidos.
- Datos corruptos o versión desconocida → estado vacío, nunca excepción.
- Coste temporal: los datos quedan duplicados en localStorage.

---

## ADR-020 — Referencias rotas conservadas

### Decisión

Un `RundownItem` cuya fuente ya no existe se conserva: se muestra como
"Contenido faltante" con el título snapshot y solo el usuario puede
eliminarlo. Nunca se borra en cascada ni se inventa contenido.

### Consecuencias

En `projectToPresentation` la referencia rota produce un `PresentationItem`
sin slides, que el motor ya sabe saltar (Fase 4). El rundown y la presentación
conservan la misma numeración de posiciones.

---

## ADR-021 — Eliminar una Song en uso: advertir, no bloquear

### Decisión

Al eliminar una canción usada en projects, el diálogo indica cuántas veces y
en qué projects se usa. Si el usuario confirma, la canción se elimina y esas
apariciones quedan como contenido faltante.

### Motivo

Bloquear obligaría a editar proyectos antiguos solo para limpiar la
biblioteca; borrar en cascada destruiría trabajo del usuario en silencio.

### Consecuencias

El cálculo de uso es una función pura (`findSongUsage`) y se compone en la
ruta: `features/songs` no importa lógica, contextos ni servicios de
`features/projects`. La UI de Songs recibe los datos de uso por props, así que
no hay dependencia ni ciclo entre features.

---

## ADR-022 — Preview y Program separados

### Decisión

`PresentationState` guarda `previewItemId` + `previewSlideId` y, de forma
independiente, `programSlideId`. El item de Program se deriva del runtime; no
se almacena.

### Motivo

Guardar el par item/slide de Program permitiría estados contradictorios. Un
único id es siempre resoluble mediante `slideLocationById`.

### Consecuencias

Cierra ADR-017: los selectores neutrales pasan a `getPreviewItem` /
`getPreviewSlide`, y se añaden `getProgramItem`, `getProgramSlide` y
`getProgramOutput`.

---

## ADR-023 — Live opera sobre un snapshot

### Decisión

Live compone el show una vez (`buildLiveSnapshot`) y no vuelve a leer la
biblioteca por su cuenta. Si el origen cambia, avisa y ofrece **Recargar
presentación**. Cambiar el Project activo tampoco recarga: ofrece **Cargar
este proyecto**.

### Motivo

Durante la operación, un cambio silencioso de contenido es un fallo de
producción. Además, recomponer cambia ids de slide y Program podría quedar
apuntando a nada.

### Consecuencias

El desfase se detecta con una firma barata (`updatedAt` del Project y de las
Songs referenciadas), así que un guardado sin cambios reales puede producir un
falso positivo.

---

## ADR-024 — ProgramMode como estado de salida

### Decisión

`programMode: "content" | "clear" | "black"`, ortogonal al contenido.
`clear` y `black` nunca borran `programSlideId`. No existe un comando que
vacíe Program en la Fase 6; si hiciera falta se llamaría `resetProgram()`.

### Consecuencias

Volver a `content` devuelve al aire exactamente la misma slide. `logo` se
añadirá al tipo cuando existan Presets y Media.

---

## ADR-025 — Selección + TAKE

### Decisión

El click selecciona en Preview; solo TAKE envía a Program. Next y Previous
mueven Preview, tanto con botones como con teclado.

### Motivo

Mandar contenido al aire por un click accidental es el error más caro en
producción. Una sola semántica de navegación evita ambigüedad.

### Consecuencias

Los items sin slides y las referencias rotas son seleccionables, pero TAKE
queda deshabilitado y es no-op. Un modo rápido que avance Program se evaluará
en una fase posterior.

---

## ADR-026 — loadPresentation frente a reloadPresentation

### Decisión

Dos comandos explícitos: `loadPresentation` (inicio o cambio de show, descarta
Program) y `reloadPresentation` (recarga pedida por el operador, conserva
Preview y Program cuando sus ids siguen existiendo).

### Motivo

Un único `load` con comportamiento distinto según un flag de la UI esconde
semántica crítica en la capa equivocada y es difícil de probar.

### Consecuencias

Ambos comandos se prueban por separado, incluido el caso en que la slide de
Program desaparece y el modo vuelve a `content`.

## ADR-027 — BroadcastChannel como transporte de Output Sync

**Estado:** aceptada (Fase 7).

`/output/main` vive en otra ventana del mismo navegador: no comparte el
runtime JavaScript de Live, así que importar el mismo store NO sincroniza
nada. Se adopta `BroadcastChannel` (canal `broadcast-control.output.v1`)
detrás de la interfaz `OutputTransport`, con un transporte en memoria para
tests. Los componentes React nunca tocan `BroadcastChannel` directamente.
La sincronización entre dispositivos queda fuera de alcance.

## ADR-028 — Protocolo Output Sync

**Estado:** aceptada (Fase 7).

Mensajes: `hello` (Output → Live), `snapshot` (respuesta completa),
`update` (cambio de Program) y `bye` (cierre de Live, optimización).
Siempre se transmite el estado completo, nunca deltas. `sessionId` efímero
generado al montar Live; `sequence` incremental por sesión descarta
mensajes fuera de orden. Liveness: `hello` cada 2 s; si no llega señal
válida de la sesión vinculada en 5 s, Output pasa a salida segura. `bye`
acelera la transición pero NO es la garantía: el timeout lo es.

## ADR-029 — Vinculación de sesión: un Output, un Live

**Estado:** aceptada (Fase 7).

Output adopta el `sessionId` del primer snapshot válido y, mientras esa
sesión siga viva, ignora `snapshot`/`update` de cualquier otra. La sesión
termina por `bye` o por timeout; solo entonces Output queda libre y puede
adoptar otra. Limitación documentada: con dos Live simultáneos, Output se
queda con el primero que responda; no hay selección manual de sesión.

## ADR-030 — Superficie segura de Output: negro puro

**Estado:** aceptada (Fase 7).

Sin sesión Live válida (antes del primer snapshot, tras `bye`, tras timeout
o ante datos inválidos) la salida es NEGRO PURO (`--output-safe`), igual que
`ProgramMode = black`. `clear` y `content` sin slide usan el fondo base
opaco (`--output-base`). La diferencia se mantiene con tokens semánticos;
nada de mensajes de error proyectados.

## ADR-031 — Providers de datos estables en el App Shell

**Estado:** aceptada (Fase 7.1).

`ProjectsProvider` y `SongsProvider` se montan una única vez en
`src/routes/_app.tsx`. Los layouts de ruta no pueden volver a montarlos.

**Motivo:** con `SongsProvider` montado por ruta (`projects`, `songs`,
`live`), cada navegación desmontaba el provider, releía y validaba
`localStorage` y mostraba "Cargando canciones…" durante la transición.

**Consecuencia:** se añade `hasLoaded` al estado de Projects y Songs,
separado de `loading` y de `error`. Las vistas usan `hasLoaded` para el
primer render; una recarga posterior nunca reemplaza la pantalla completa.
El contrato queda cubierto por `tests/routing/*`.

## ADR-032 — Preset separado del contenido

**Estado:** aceptada (Fase 8).

El contenido (Song, Slide) y la apariencia (Preset) son entidades distintas.
Ninguna propiedad visual se guarda dentro del texto de una Song. `Preset`
contiene identidad, nombre, fechas y un `PresetStyle` con tipografía, tamaño,
peso, interlineado, alineación H/V, color de texto, fondo sólido discriminado
y safe area. El tamaño y la safe area son porcentajes del lienzo, no píxeles,
para que Preview, Program y Output 1920×1080 coincidan.

## ADR-033 — Default Preset reservado

**Estado:** aceptada (Fase 8).

Existe un preset con id reservado `preset-default`, sintetizado en memoria y
nunca persistido. No se edita ni se elimina, pero sí se duplica. El sistema
jamás queda sin estilo válido: cualquier referencia ausente, desconocida o
corrupta resuelve al Default.

## ADR-034 — Preset por aparición del rundown

**Estado:** aceptada (Fase 8).

`RundownItem.presetId?` es el único punto de asignación en esta fase. Así la
misma Song puede verse distinta en dos momentos del show sin modificarla. Al
eliminar un preset en uso se advierte con el número de apariciones afectadas y
esos items caen al Default; no se reescriben los proyectos, la resolución
tolerante evita referencias visuales rotas.

## ADR-035 — Renderer compartido

**Estado:** aceptada (Fase 8).

El cálculo visual vive en la función pura `resolveSlideRenderStyle` y se
aplica en un único componente `SlideRenderer`, usado por Live Preview, Live
Program, `/output/main` y la vista previa del editor. Ninguna superficie
define tipografía, color o fondo por su cuenta, y el renderer no depende del
App Shell ni de providers.

## ADR-036 — Estilo resuelto y congelado en el snapshot

**Estado:** aceptada (Fase 8).

`projectToPresentation` solo propaga `presetId`; `buildLiveSnapshot(project,
songs, presets)` resuelve y congela el estilo. `OutputSnapshot.slide` viaja
con su `style` resuelto para que Output no lea repositories. La comparación de
snapshots incluye el estilo: misma slide y mismo texto con estilo distinto
publican update. Editar un Preset con Live abierto no altera Program; genera
el aviso de contenido desactualizado hasta que el operador recarga.

## ADR-037 — Auto-advance de Program dentro del item al aire

**Estado:** aceptada (Fase 8.1). Extiende ADR-025.

Next/Previous auto-avanzan Program únicamente dentro del mismo item que ya
está al aire; cruzar de item requiere TAKE.

La regla vive en comandos operativos de Live (`nextLive` / `previousLive` en
`src/domain/presentation/presentation-live.ts`), no en componentes React.
`next` / `previous` del Presentation Engine siguen siendo navegación pura de
Preview. El store de Live enruta sus comandos de navegación a los operativos,
así que botones y teclado comparten semántica.

Condiciones para arrastrar Program: hay Program, el item de Program (derivado
de `programSlideId`) coincide con el item de Preview antes del salto, y la
slide destino pertenece a ese mismo item. En cualquier otro caso —cruce de
item, item vacío, referencia rota, sin Program— solo se mueve Preview.

`programMode` nunca cambia en el auto-advance: en `clear` o `black` el
contenido avanza internamente y la salida sigue vacía o negra (ADR-024). Solo
TAKE fuerza `content`.

## ADR-039 — Modelo canónico de Biblia separado del formato externo

**Estado:** aceptada (Fase 9).

El JSON de importación no es el modelo de dominio. Existe una capa de
adaptadores (`BibleImportAdapter`: `formatName`, `canImport`, `toCanonical`)
que convierte cualquier formato externo en `CanonicalBible`. El primer
adaptador cubre el formato `version_id` + `books[].chapters[].items[]`.

Se conserva solo lo necesario para navegar y presentar: abreviatura, título,
idioma, publisher, copyright, `book_usfm`, nombre de libro, número de capítulo
y número de versículo con sus líneas de texto. Se descarta `chapter_html`,
todo el markup, los enlaces previous/next y la metadata duplicada. Dominio,
repositorio y UI nunca ven la forma externa, así que agregar otro formato es
agregar otro adaptador.

La frontera es tolerante con los tipos del archivo real: `verse_numbers` y
`version_id` se aceptan como texto o número, y `publisher`/`copyright` pueden
llegar como objeto (`{ name }`, `{ text, html }`), del que se toma el texto y
nunca el HTML. La normalización vive en el adaptador; el modelo canónico sigue
siendo estricto.

## ADR-041 — Un versículo por slide y líneas originales

**Estado:** aceptada (Fase 9).

`passageToPresentationItem` genera una slide por versículo. Las `lines` del
versículo se conservan tal cual (un versículo multilínea proyecta varias
líneas); las líneas vacías se descartan. Cada slide lleva `label` interno
(`Juan 3:16`, usado por la rejilla de Live) y `secondaryText` proyectable
(`Juan 3:16 · NVI`).

`Slide.secondaryText?: string` es genérico, no bíblico: el renderer compartido
lo pinta como una línea secundaria discreta bajo el texto principal y viaja en
`OutputSnapshot`. Las Songs simplemente no lo usan.

## ADR-042 — El pasaje se congela en el Rundown

**Estado:** aceptada (Fase 9).

Al agregar un pasaje al Project se guarda el texto completo en
`RundownItem.payload` (`{ kind: "bible"; passage }`). `projectToPresentation`
lee únicamente ese payload y nunca consulta `BibleRepository`; Live tampoco
toca IndexedDB y Output no conoce Bible.

Consecuencia deliberada: eliminar una traducción instalada muestra una
advertencia, borra la Biblia de IndexedDB y **no** reescribe ningún Project.
Los items Bible existentes se siguen convirtiendo en slides, se abren en Live,
hacen TAKE y llegan a Output. La traducción instalada solo hace falta para
navegar `/bible`, buscar referencias y crear pasajes nuevos.

"Contenido faltante" aparece solo si el propio payload está ausente, inválido
o corrupto: un payload ilegible se descarta sin invalidar el item, que queda
como placeholder.

## ADR-043 — Un clic en una slide la envía al aire

**Estado:** aceptada (Fase 9.1).

En operación real el operador hace clic en la slide que quiere ver. Exigir
clic + TAKE producía el error más caro posible: creer que se proyectó algo
mientras la pantalla seguía igual.

`goLive(state, slideId)` es una operación explícita del dominio
(`presentation-live.ts`) que reutiliza internamente `selectSlide` + `take` y
**además fuerza `programMode = "content"`**. Desde Clear o Black, un clic
directo vuelve a contenido y muestra la slide inmediatamente en Program y en
Output. Es no-op si el id no existe en el runtime.

TAKE conserva su semántica: Preview → Program → `content`. El clic sobre un
RundownItem sigue moviendo solo la selección/Preview, para no cambiar una
canción entera por accidente.

## ADR-044 — Alta incremental desde Live, sin recarga genérica

**Estado:** aceptada (Fase 9.1).

Agregar contenido desde el Library Dock no puede reconstruir el show: Live
trabaja sobre un snapshot congelado y una recarga implícita cambiaría items
que ya están al aire.

Se distinguen dos operaciones:

- **Recargar presentación:** acción explícita del operador
  (`reloadLiveSession`); incorpora todos los cambios externos detectados.
- **Agregar desde Live:** `appendPresentationItem(state, item)` añade un único
  `PresentationItem` al final del runtime. No reconstruye los items
  existentes, no toca `programMode` ni Program, y solo posiciona Preview si no
  había ninguna selección.

`appendToLiveSession` adopta la nueva firma del Project (para que la propia
alta no genere un falso aviso de desfase) pero conserva `staleExternal`: un
cambio externo pendiente sigue pendiente y el aviso de "Recargar presentación"
permanece.

"Rundown" persiste el item y extiende el runtime sin tocar Program ni Preview.
"Al aire" hace lo mismo y además aplica `goLive` sobre la primera slide nueva.
No existen items temporales: lo que se ve en el show está siempre en el
Project.


## ADR-045 — La salida sobrevive a quitar el item que está al aire

**Contexto.** En Live se puede quitar una aparición del rundown durante la
reunión, incluso la que se está proyectando. Cortar la salida a negro en ese
momento es inaceptable.

**Decisión.** `PresentationState` gana `detachedProgramSlide: Slide | null`.
Al quitar el item que contiene la slide al aire, esa slide se copia COMPLETA
(líneas, `secondaryText`, estilo resuelto) en `detachedProgramSlide` y
`programSlideId` pasa a `null`: no queda ninguna referencia al item eliminado.
`getProgramSlide` cae en esa copia, así que el `OutputSnapshot` sigue siendo
visualmente idéntico y la salida no parpadea. Clear y Black siguen operando
sobre ella. `take` y `goLive` la limpian y devuelven Program a una slide del
runtime; ambos fuerzan `programMode = "content"` incluso desde Clear o Black.
`programSlideId` y `detachedProgramSlide` nunca están activos a la vez.

**Consecuencias.** `getProgramItem` devuelve `null` con la salida congelada:
la UI muestra "Fuera del rundown". La baja es incremental (`removePresentationItem`,
`removeFromLiveSession`): no reconstruye el show ni limpia un aviso de cambios
externos pendientes, y adopta el Project ya persistido para que la firma coincida.

## ADR-046 — El Library Dock no tiene estado de Biblias propio

**Contexto.** La pestaña Bible de Live debe mostrar exactamente las traducciones
instaladas, sin duplicar almacenamiento ni tocar IndexedDB.

**Decisión.** El dock consume `BibleContext` (el mismo proveedor que `/bible`) y
`resolveBibleVersionSelection` concentra la regla de selección: una traducción se
autoselecciona y se persiste; con varias manda la última elegida localmente; si la
elegida ya no existe se cae a la primera y se reescribe la preferencia; sin ninguna
no hay selector, solo un estado vacío. `classifyReferenceInput` distingue entrada
incompleta (mensaje neutro) de referencia formada pero inválida (error). Al montar
Live y al recuperar el foco se revalida SOLO la metadata de traducciones.

## ADR-047 — La salida se ubica en el proyector con la Window Management API

**Contexto.** La aplicación es web/PWA y se opera en Chrome o Edge sobre Windows
con un proyector como segunda pantalla. Mover la ventana de salida a mano en cada
reunión es lento y propenso a errores, pero no se quiere Tauri ni Electron.

**Decisión.** Un único servicio (`src/services/display/window-management.ts`)
concentra todo el contacto con la API: feature detection, `isSecureContext`,
estado del permiso `window-management` y normalización a `ScreenInfo`.
`getScreenDetails()` se llama SOLO desde un gesto del usuario («Detectar
pantallas»), que es lo que permite al navegador pedir permiso. La pantalla
elegida se persiste como huella normalizada (etiqueta, resolución, área
disponible, posición, escala, principal) en `broadcast-control.display.audience`,
porque los identificadores nativos no son estables entre sesiones.

El emparejado es conservador: exacto → etiqueta + geometría → geometría con una
única candidata no principal; ante varias candidatas es ambiguo y NO se abre
nada. Nunca se cae en la pantalla principal.

`openOutputWindow` usa el nombre fijo `audience-main`, de modo que reabrir
reutiliza la ventana en lugar de duplicar la salida, y luego intenta mover,
redimensionar y enfocar de forma tolerante a las restricciones del navegador.

**Consecuencias.** Sin la API (Firefox, Safari) se conserva el comportamiento
actual: ventana suelta más la indicación «Mové esta ventana al proyector y
presioná F». El pantalla completa nunca es automático (los navegadores lo
bloquean): botón «Iniciar salida», tecla F o doble clic, con `screen` cuando el
navegador lo admite y sin él como respaldo. Si el proyector se desconecta, Live
lo informa y no toca Program ni mueve la ventana ya abierta.

## ADR-048 — Media es contenido referencial, nunca estilo de Preset

Los archivos de Media (imágenes y videos) se referencian por `mediaId` desde RundownItems; `PresetStyle` no se amplía y los fondos de preset siguen siendo solo `solid`. Eliminar un asset en uso lanza `MediaInUseError` con cantidad de elementos y proyectos afectados.

## ADR-049 — Capas de almacenamiento separadas

`MediaRepository` solo metadata (IndexedDB), `MediaFileStorage` solo bytes (OPFS con streaming `file.stream().pipeTo()` y archivo temporal `.part`, o IndexedDB Blob limitado a imágenes), `MediaService` coordina con importación compensable: bytes primero, metadata después; si la metadata falla, se borran los bytes. Los videos sin OPFS se rechazan con mensaje claro. `navigator.storage.persist()` se solicita una vez y nunca bloquea; la persistencia no es absoluta y se documenta.

## ADR-050 — VideoPlaybackState autoritativo y sincronizable

`VideoPlaybackState { state, offsetSeconds, changedAtEpochMs, loop, revision }` vive en Live y se publica a Output con cada snapshot. Output aplica play/pause/offset con tolerancia de deriva de 0,35 s y vigilancia cada 1 s; el video corre `muted` y sin controles nativos.
