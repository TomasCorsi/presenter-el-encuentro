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
semántica falsa. Un rename controlado en la Fase 5 es preferible.

### Consecuencias

En la Fase 5, al aparecer `previewSlideId` y `programSlideId`, se añadirán
`getPreviewSlide()` y `getProgramSlide()` con un rename controlado.
`clear`, `black` y `logo` quedan fuera del motor: son estado de salida.
