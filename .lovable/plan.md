# Fase 9.3 — Output sobre proyector (segunda pantalla)

Objetivo: detectar las pantallas del equipo, configurar una como proyector y abrir la salida
directamente sobre ella, sin romper nada de lo que ya funciona.

No se toca el motor de presentación, el protocolo de sincronización, Live, Preview ni Program.
Sin dependencias nuevas: solo API nativa del navegador (Window Management).

## 1. Servicio de pantallas

Nuevo `src/services/display/window-management.ts`, único lugar que habla con la API del navegador:

- Detección de capacidades sin asumir soporte: existencia de `window.getScreenDetails`,
  `window.screen.isExtended`, contexto seguro (HTTPS o localhost) y estado del permiso
  `window-management` vía `navigator.permissions.query`, cuando exista.
- `requestScreenDetails()`: llama a `getScreenDetails()`. Se invoca **solo** desde el clic en
  «Detectar pantallas», para que el navegador muestre su pedido de permiso en un gesto de usuario.
- Normaliza cada pantalla a un objeto propio: etiqueta, ancho/alto, `availWidth/availHeight`,
  `availLeft/availTop`, `devicePixelRatio`, `isPrimary`.
- `fingerprintScreen(screen)`: firma estable con label + medidas + posición + dpr + primary.
- `matchScreen(fingerprint, screens)`: coincidencia exacta y, si falla, coincidencia por medidas +
  posición (la etiqueta puede cambiar entre sesiones).
- Suscripción a cambios (`screenschange` en `ScreenDetails`, `change` en cada pantalla) con función
  de limpieza.

Sin API disponible: devuelve `{ supported: false }` y todo lo demás degrada al comportamiento actual.

## 2. Preferencia guardada

Nuevo `src/services/display/display-preference.ts` (localStorage, mismo patrón que las demás
preferencias locales del puesto): clave `broadcast-control.display.audience`, valor = fingerprint del
proyector. Es preferencia local del equipo, nunca del Project. Lectura tolerante a datos corruptos.

Hook `src/features/display/use-audience-screen.ts`: reúne capacidades, pantallas detectadas,
pantalla configurada, resolución de la coincidencia y acciones (detectar, guardar, olvidar).

## 3. Settings → Outputs

`src/routes/_app.settings.tsx` deja de ser estado vacío y gana la sección **Pantalla del proyector**:

- Estado: configurada / no configurada; cantidad de pantallas detectadas.
- Tabla compacta por pantalla: etiqueta, resolución, posición, marca de principal, marca de proyector.
- Selector para asignar la pantalla de audiencia.
- Botones: «Detectar pantallas», «Identificar», «Probar salida», «Olvidar configuración».
- Exactamente dos pantallas: se propone la no principal como proyector y se pide confirmación
  explícita antes de guardar. Más de dos: el usuario elige.
- Sin soporte, sin contexto seguro o permiso denegado: explicación en texto claro y el modo alternativo.

«Identificar» abre brevemente en cada pantalla una ventana con un número grande y la cierra sola.
«Probar salida» abre la salida en el proyector con una tarjeta de prueba y permite cerrarla.

`/outputs` (hoy placeholder) enlaza a esta sección para que el operador la encuentre.

## 4. Abrir Output sobre el proyector

Nuevo `src/features/output/open-output-window.ts`, usado por el botón «Abrir Output» de
`live-show-bar.tsx`:

1. Consulta pantallas; busca la configurada por fingerprint.
2. Si aparece: `window.open("/output/main", "audience-main", "popup=yes,left=…,top=…,width=…,height=…")`
   con los valores `availLeft/availTop/availWidth/availHeight` de esa pantalla.
3. Nombre fijo `audience-main`: reabrir reutiliza y enfoca la misma ventana, nunca duplica.
4. `focus()` sobre la ventana y estado «Output abierto» en la barra de show.
5. Si la pantalla guardada no aparece: **no** se abre en la principal; se muestra
   «Proyector desconectado» con acceso a volver a detectar.
6. Popup bloqueado (`window.open` devuelve nulo): «El navegador bloqueó la salida. Permití ventanas
   emergentes para este sitio y volvé a intentarlo.»

Sin configuración o sin soporte: se abre una ventana nueva como hoy, con el aviso
«Mové esta ventana al proyector y presioná F para pantalla completa.»

La barra de show pasa a mostrar el estado de la salida: abierta, cerrada, proyector desconectado.
Se escuchan los cambios de pantallas mientras Live está abierto; si el proyector desaparece, el estado
cambia pero Program y la ventana existente no se tocan.

## 5. Pantalla completa en /output/main

- Se mantiene el overlay discreto; el botón pasa a llamarse «Iniciar salida».
- Tres vías: botón, tecla `F` y doble clic (ya existente).
- `requestFullscreen({ navigationUI: "hide", screen })` cuando la opción `screen` sea aceptada por el
  navegador; si no, `requestFullscreen({ navigationUI: "hide" })`, y si eso falla, la llamada simple.
- Nunca fullscreen automático al cargar.
- En fullscreen: sin botón, sin cursor, sin mensajes; fondo negro inicial. Al salir con Escape los
  controles vuelven.

## 6. Pruebas

Unitarias (`bun test`), con un doble de la API de pantallas:

- Capacidades: API ausente, contexto no seguro, permiso concedido / denegado / pendiente.
- Fingerprint: estable, coincide tras cambio de etiqueta, no coincide con otra pantalla.
- Selección automática con dos pantallas; elección manual con tres; una sola pantalla.
- Preferencia: guardar, leer, olvidar, dato corrupto.
- Apertura: rectángulo correcto, reutilización por nombre, popup bloqueado, pantalla guardada ausente
  (no abre en la principal).
- Fullscreen: usa `screen` cuando se acepta, degrada cuando no.

Verificación en navegador: `/live` y `/output/main` sin errores de consola, salida y Program
sincronizados, reapertura sin duplicar ventanas, `F` y doble clic. La API de pantallas múltiples no se
puede ejercitar de verdad en el entorno de pruebas automatizado: el camino con proyector real queda
para tu verificación en Windows, y lo dejo documentado.

## 7. Archivos

Nuevos: `src/services/display/window-management.ts`, `src/services/display/display-preference.ts`,
`src/features/display/use-audience-screen.ts`, `src/features/display/components/audience-screen-settings.tsx`,
`src/features/output/open-output-window.ts`, `src/features/output/use-fullscreen.ts`,
`tests/services/window-management.test.ts`, `tests/features/audience-screen.test.ts`,
`tests/features/open-output-window.test.ts`.

Modificados: `src/routes/_app.settings.tsx`, `src/routes/_app.outputs.tsx`,
`src/features/live/components/live-show-bar.tsx`, `src/routes/_app.live.tsx`,
`src/routes/output.main.tsx`, `src/features/output/components/output-overlay.tsx`,
docs (`DECISIONS` con un ADR nuevo sobre la salida en segunda pantalla, `ARCHITECTURE`, `TESTING`,
`ROADMAP`, `roadmap.md`).

## 8. Riesgos

- El permiso de gestión de ventanas solo se concede en contexto seguro y tras gesto del usuario: toda
  la ruta de detección arranca en un clic.
- Las etiquetas de pantalla pueden venir vacías sin permiso concedido: el fingerprint no depende solo
  de la etiqueta.
- Firefox y Safari no implementan la API: el camino alternativo es el comportamiento actual, intacto.
- Renderizado en servidor: todo el acceso a `window` ocurre tras el montaje en cliente.

## 9. Precisiones aprobadas

1. La referencia nativa de cada pantalla se conserva en memoria durante la sesión; solo se persiste el
   modelo normalizado. En la salida, «Iniciar salida» vuelve a pedir las pantallas si el permiso ya está
   concedido y usa `currentScreen` para el fullscreen; si no se puede, fullscreen sin `screen`.
2. Al reutilizar la ventana `audience-main` se comprueba `closed` y se aplican `moveTo`, `resizeTo` y
   `focus()`, cada uno tolerante a excepciones del navegador.
3. El estado «Output abierto» se mantiene veraz con una comprobación periódica moderada de `closed`;
   timers y listeners se limpian al desmontar Live.
4. «Identificar» actúa sobre una pantalla por vez, informa si el navegador bloqueó la ventana, ofrece
   cierre manual además del automático y nunca deja ventanas abiertas.
5. La prueba usa `/output/main?mode=test`: patrón, número de pantalla y resolución, botón de cierre; no
   se suscribe al canal de sincronización ni toca Program.
6. Coincidencia conservadora: exacta; label + resolución + posición; resolución + posición solo si hay
   una única candidata no principal; ambigua → «Proyector no identificado» y no se abre la salida.
7. Declaraciones de tipos locales mínimas para la API de gestión de ventanas, sin `any` general ni
   dependencias nuevas.
8. `window.isSecureContext` como comprobación principal.
9. Todos los listeners (`screenschange`, `change` por pantalla, cierre de la salida) con limpieza.
10. Checklist de verificación manual en Windows documentada en `docs/TESTING.md`.
