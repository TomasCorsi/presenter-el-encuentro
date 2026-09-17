# Fase 7 — Output Main

Salida de presentación independiente en `/output/main`, sincronizada con el
Program de Live dentro del mismo navegador. Live manda; Output solo muestra.

---

## 1. Ruta y encuadre

- Nueva ruta `src/routes/output.main.tsx` → `/output/main`. Queda fuera de
  `_app`, así que no hereda sidebar, topbar ni breadcrumbs.
- Ocupa el viewport completo (`h-dvh w-dvw overflow-hidden`), sin scroll.
- `head()` propio con `robots: noindex` y título corto; no es una página para
  compartir.
- Render seguro en servidor: en SSR y en el primer render pinta la salida
  vacía. Toda la conexión (BroadcastChannel, teclado, ratón, fullscreen) se
  monta en `useEffect`.

Contenido: una superficie 16:9 centrada con safe area, sin ningún texto de
sistema. Nunca aparecen mensajes tipo "No hay contenido": lo que no se puede
mostrar se muestra vacío.

---

## 2. Sincronización: BroadcastChannel

Sí, BroadcastChannel, por detrás de una interfaz de transporte.

Motivo: es la única API pensada exactamente para esto (mismo origen, varias
pestañas, sin servidor), es nativa, no añade dependencias, entrega en el mismo
tick y no ensucia el almacenamiento. Las alternativas locales son peores:
`localStorage` + evento `storage` persiste estado operativo que decidimos no
persistir y no notifica a la pestaña que escribe; `window.postMessage` exige
guardar la referencia a la ventana abierta y se pierde si el operador recarga
o abre Output a mano; `SharedWorker` no tiene soporte fiable en todos los
navegadores de destino.

El transporte se define como interfaz (`publish`, `subscribe`, `close`) con
dos implementaciones: BroadcastChannel real y un transporte en memoria para
tests. Los componentes React nunca tocan la API del navegador directamente.

```text
PresentationStore (Live)
  → OutputPublisher (servicio)
      → OutputTransport (BroadcastChannel | memoria)
          → OutputSubscriber (servicio)
              → OutputStore / snapshot
                  → /output/main
```

---

## 3. Protocolo de mensajes

Canal `broadcast-control.output.v1`. Cuatro mensajes, todos validados al
recibir; cualquier mensaje con forma inválida se ignora en silencio.

| Mensaje | Emisor | Cuándo | Carga |
| --- | --- | --- | --- |
| `hello` | Output | al montar y al reconectar | `{ type }` |
| `snapshot` | Live | al recibir `hello` y al montar Live | snapshot completo |
| `update` | Live | cada vez que cambia lo que Output ve | snapshot completo |
| `bye` | Live | al desmontarse / cerrar la pestaña | `{ sessionId }` |

`snapshot` y `update` llevan siempre el estado completo (no deltas): el
snapshot es pequeño y así una ventana nueva y una ventana antigua convergen
con el mismo mensaje.

### Política de sesión: un Output, un Live

Output NO adopta cualquier `sessionId` que reciba. Regla explícita:

- Al recibir el **primer snapshot válido**, Output queda **vinculado** a ese
  `sessionId`.
- Mientras esa sesión siga viva, ignora `snapshot` y `update` de cualquier
  otro `sessionId`. Esto evita que dos ventanas Live abiertas hagan que
  Output alterne entre ellas.
- La sesión termina por `bye` o por timeout de heartbeat (punto 3.2). Solo
  entonces Output queda libre y puede adoptar la primera sesión válida que
  responda.
- Si Output abre con dos Live ya activos, adopta el primero que responda y lo
  mantiene. **Limitación documentada:** no hay selección manual de sesión en
  esta fase; la recomendación operativa es tener un solo Live abierto.

### Liveness: heartbeat, no `bye`

`bye` se envía como optimización (desconexión inmediata), pero NO es la
garantía: un cierre de pestaña, crash o suspensión puede impedir que llegue.
La garantía real es el heartbeat:

- Output envía `hello` cada **2 s**, siempre, esté conectado o no.
- Live responde a cada `hello` con un `snapshot` (o `heartbeat` si nada
  cambió desde el último envío a esa sesión; en la práctica el snapshot
  completo es barato y simplifica el protocolo, así que se responde siempre
  con snapshot).
- Si Output no recibe ninguna señal válida de **su sesión vinculada** durante
  **5 s**, considera a Live desconectado: pasa a salida segura vacía, queda
  libre de sesión y sigue escuchando y reintentando.
- Nada de polling de estado de aplicación ni de storage: el heartbeat vive
  solo en el protocolo Output Sync.

### Inicialización de una ventana nueva

- **Output abre después de Live:** el `hello` periódico obtiene `snapshot`
  en el primer ciclo (latencia máxima ~2 s; el primer `hello` se envía al
  montar, así que en la práctica es inmediato).
- **Live abre después de Output:** Live emite `snapshot` al montar y además
  responde al `hello` periódico; Output lo adopta como primera sesión.
- **Output se cierra y se reabre / se recarga:** repite `hello` y recibe el
  estado actual. No hay estado que restaurar.
- **Varias ventanas Output:** el canal es difusión pura. Cada Output mantiene
  su propia vinculación de sesión y su propio contador de secuencia; todas
  convergen al mismo contenido.

### Live ausente

Sin respuesta a `hello` durante 5 s (o `bye` recibido): salida vacía segura
(negra). Sin texto de error, sin spinner, sin nada proyectable. El único
indicador de desconexión vive dentro del overlay de configuración (punto 7),
que solo aparece con actividad del ratón o del teclado.

### Reconexión

Output nunca deja de emitir `hello` ni de escuchar. Cuando aparece una sesión
Live nueva, su `snapshot` llega en respuesta al siguiente `hello` y, como
Output ya está libre, la adopta: nuevo `sessionId`, secuencia reiniciada.

---

## 4. `sessionId` y `sequence`

Ambos, sí, y son baratos.

- `sessionId`: identificador efímero generado al montar Live (nunca en módulo
  ni en SSR: se crea en `useEffect`, regla de la plataforma). No se persiste.
  Sirve para la vinculación de sesión del punto 3.1.
- `sequence`: entero incremental **por sesión**. Output descarta cualquier
  mensaje con `sequence` menor o igual al último aplicado **de su sesión
  vinculada**. Protege contra el reordenamiento que puede producir el
  `snapshot` de respuesta a un `hello` cruzándose con un `update`. Al adoptar
  una sesión nueva, la secuencia se reinicia.

---

## 5. `OutputSnapshot`

Contenido resuelto: Output nunca lee Projects ni Songs ni reconstruye nada.

```ts
interface OutputSlide {
  id: string;
  lines: string[];
}

interface OutputSnapshot {
  sessionId: string;
  sequence: number;
  mode: "content" | "clear" | "black";
  /** Ya resuelta: null en clear, black o Program vacío. */
  slide: OutputSlide | null;
}
```

Se deriva en Live con el selector existente `getProgramOutput()`, que ya
devuelve `slide: null` en `clear` y `black`. No viaja Preview, ni el rundown,
ni títulos, ni etiquetas de sección: nada de eso se pinta en la salida.

Publicación sin retardo: el publisher se suscribe al `PresentationStore`,
recalcula el snapshot y publica al instante si cambia **cualquier cosa que
Output deba pintar**. La comparación NO es solo `mode` + `slide.id`: incluye
el contenido. Regla concreta:

```text
cambió mode  → publicar
cambió slide.id  → publicar
cambió slide.lines (mismo id)  → publicar
cualquier otra cosa (Preview, navegación…)  → NO publicar
```

El caso real que cubre: se edita una Song, el operador pulsa "Recargar
presentación", la slide conserva su id determinista pero su letra cambió, y
Output recibe el texto nuevo. La comparación se implementa como función pura
`snapshotsEqual(a, b)` (compara `mode`, `slide.id` y `lines` elemento a
elemento), simple y testeable, sin hashes. Sin debounce: un TAKE, un cambio
de modo o una recarga con contenido nuevo salen en el mismo tick.

---

## 6. `content`, `clear`, `black` y Program vacío

- **content con slide:** líneas centradas, un `<span>` por línea, respetando
  los saltos.
- **content sin slide** (`programSlideId = null`): fondo base, sin texto. Es
  el mismo render que `clear`.
- **clear:** fondo base opaco, sin contenido. **Decisión:** opaco, no
  transparente. Una salida transparente hoy mostraría el blanco del navegador
  en proyector, que es el peor resultado posible en vivo. La transparencia
  real (para browser source) llega con Presets, cuando pueda activarse de
  forma explícita.
- **black:** negro puro (`#000`), distinto del fondo base del escenario, que
  es un negro ligeramente levantado. Así "black" significa realmente apagar.

Safe area: padding proporcional al viewport mediante un token nuevo
(`--output-safe-area`, del orden del 6 % del lado menor), aplicado a la caja de
texto, no al fondo. No se añaden controles de diseño.

Tipografía neutral temporal: el stack del sistema ya en uso, tamaño escalado
con `clamp()`, peso semibold, interlineado ajustado. Sin presets todavía.

---

## 7. Fullscreen, cursor y overlay

Un único overlay de configuración, invisible durante la salida normal:

- Aparece al mover el ratón o pulsar una tecla.
- Se oculta tras 3 s de inactividad, junto con el cursor
  (`cursor: none`).
- Contiene solo un botón discreto de pantalla completa y, si procede, un punto
  de estado "sin señal de Live". Nada más.
- `F` y doble clic también alternan pantalla completa.
- Nunca se llama a `requestFullscreen()` automáticamente: los navegadores lo
  bloquean sin gesto del usuario. Si la llamada falla, se ignora sin mostrar
  error.

---

## 8. Cambio en Live

`Abrir Output` en la barra de show: `window.open("/output/main", "_blank")`,
sin gestión de monitores. Live sigue funcionando igual si no se abre nunca.

---

## 9. Archivos

**Nuevos**

- `src/domain/output/output-snapshot.ts` — tipos `OutputSlide`,
  `OutputSnapshot`, `OutputMessage`; `toOutputSnapshot(programOutput, …)`,
  `parseOutputMessage()` (validación defensiva), `EMPTY_OUTPUT`.
- `src/services/output-sync/output-transport.ts` — interfaz + implementación
  BroadcastChannel + implementación en memoria para tests.
- `src/services/output-sync/output-publisher.ts` — lado Live: sesión,
  secuencia, respuesta a `hello`, `bye`.
- `src/services/output-sync/output-subscriber.ts` — lado Output: `hello`,
  filtrado por sesión y secuencia, callback de snapshot.
- `src/features/output/use-output-publisher.ts` — hook de ciclo de vida (Live).
- `src/features/output/use-output-snapshot.ts` — hook de ciclo de vida (Output).
- `src/features/output/components/output-surface.tsx` — render de la salida.
- `src/features/output/components/output-overlay.tsx` — overlay fullscreen.
- `src/features/output/use-idle-ui.ts` — actividad de ratón/teclado y cursor.
- `src/routes/output.main.tsx` — la ruta.

**Modificados**

- `src/routes/_app.live.tsx` — monta el publisher.
- `src/features/live/components/live-show-bar.tsx` — acción `Abrir Output`.
- `src/styles.css` — tokens `--output-safe-area` y negro puro de `black`.
- `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
  `docs/DECISIONS.md`, `docs/TESTING.md`.

No se tocan el Presentation Engine ni el store: Output se construye encima de
`getProgramOutput()`.

---

## 10. Tests

`bun test`, con transporte en memoria (nada depende de BroadcastChannel real):

- Serialización y validación de `OutputSnapshot` y de cada mensaje.
- `snapshotsEqual`: mismo `slide.id` con `lines` distintas → NO son iguales →
  se publica `update` (el caso "editar la Song y recargar").
- `hello` → `snapshot`; `update` en cada cambio de Program; `bye`.
- Output que abre después de Live obtiene el estado actual.
- Output que abre antes de Live recibe el `snapshot` inicial.
- `sequence`: mensajes fuera de orden descartados; sesión nueva aceptada y
  secuencia reiniciada.
- Vinculación de sesión: Output vinculado a Live A ignora `snapshot`/`update`
  de Live B; Live A termina (`bye` o timeout) → Output queda libre y puede
  adoptar Live B.
- Heartbeat: Live desaparece sin `bye` → tras el timeout Output pasa a salida
  segura; Live vuelve → Output recupera el snapshot; `bye` → desconexión
  inmediata sin esperar al timeout.
- Múltiples subscribers reciben el mismo snapshot.
- Mensajes inválidos (forma incorrecta, campos faltantes, JSON ajeno)
  ignorados sin lanzar.
- `content` con slide, `clear`, `black`, Program vacío.
- Preview que se mueve NO produce publicación.

**Verificación en navegador** (Playwright, 1920×1080 y ventana secundaria):
la secuencia completa de 20 pasos del pedido, incluidos dos Outputs
simultáneos y la recarga de Output.

---

## 11. ADR propuestas

- **ADR-027 — BroadcastChannel para sincronización local**: por qué, y por qué
  no `localStorage`, `postMessage` ni `SharedWorker`; límite explícito a un
  mismo navegador y dispositivo.
- **ADR-028 — Protocolo Output Sync**: `hello` / `snapshot` / `update` / `bye`,
  estado completo en cada mensaje, `sessionId` efímero y `sequence`.
- **ADR-029 — Live es la única autoridad**: flujo unidireccional, Output sin
  comandos.
- **ADR-030 — Salida segura por defecto**: sin Live, sin Program o con datos
  inválidos la salida es vacía y silenciosa; `clear` opaco hasta que exista
  transparencia explícita.

---

## 12. Fuera de alcance

Stage Display, Stream Output, Remote, sincronización entre dispositivos,
WebSocket, Supabase Realtime, presets, backgrounds, vídeo, imágenes,
tipografía configurable, transiciones, lower thirds, Bible, Media, logo, PWA,
IndexedDB, cloud sync, selección de monitor, NDI/SDI/DeckLink/Spout.
Sin dependencias nuevas.

---

## 13. Decisiones que necesitan tu visto bueno

1. **`clear` opaco, no transparente.** Prioriza el proyector; la transparencia
   llega con Presets.
2. **Sin señal de Live = salida vacía, no última slide congelada.** Si
   prefieres congelar el último contenido, cámbialo aquí.
3. **Tiempo de espera antes de vaciar** tras perder la señal: propongo
   inmediato con `bye` y 5 s sin respuesta al reintento. Ajustable.
4. **Overlay y ocultado de cursor a los 3 s.** Se puede subir o quitar.
5. **Riesgo aceptado:** BroadcastChannel no funciona entre navegadores ni
   dispositivos distintos, ni en modo incógnito contra una ventana normal. La
   salida en otro equipo es una fase posterior.
6. **Riesgo aceptado:** no hay persistencia. Recargar Live pierde la sesión y
   los Outputs se quedan en vacío hasta que Live vuelva a cargar el show.
