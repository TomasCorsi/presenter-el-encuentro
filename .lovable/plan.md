# Fase 9.2 — Correcciones de Live, Bible Dock y Rundown

Tres frentes: la pestaña Bible de la consola, poder quitar elementos del rundown (desde Projects y desde Live) y quitar el monitor Preview para agrandar Program.

---

## 1. Bible dentro de Live

### Diagnóstico (parcialmente confirmado por lectura del código)

La pestaña Bible de la consola YA usa el mismo contexto que la pantalla Bible (`useBible`), así que no hay almacenamiento paralelo. Lo que sí está mal, y se ve en el código:

1. **La lista de libros se pide sin manejo de error.** En la pantalla Bible la carga de libros atrapa el fallo; en la consola no. Si esa lectura falla o tarda, la lista de libros queda vacía y entonces *toda* referencia se declara no reconocida: parece "no carga la Biblia" aunque la Biblia esté instalada.
2. **La traducción guardada nunca se valida ni se corrige.** La consola recuerda una traducción en la preferencia local, pero si esa traducción ya no existe usa la primera disponible sin volver a guardar la preferencia, y el selector puede quedar mostrando algo distinto de lo que realmente se consulta.
3. **Con una sola Biblia no se autoselecciona de verdad**: se usa por descarte, no queda registrada.
4. **El error de referencia aparece demasiado pronto**: escribir "Juan" ya muestra "No se reconoce la referencia".

La causa exacta del caso del usuario (Biblia instalada que no aparece) se confirma como primer paso, reproduciendo en el navegador con una Biblia real importada y mirando la consola del navegador. Si el fallo real resulta ser otro, se corrige ese y se mantienen igualmente las mejoras 2–4.

### Corrección

- Un único hook `useBibleVersionSelection` que resuelve la traducción efectiva: si hay una sola la elige y la persiste; si hay varias usa la última elegida; si la elegida ya no existe cae a la primera y reescribe la preferencia; si no hay ninguna devuelve `null`.
- Sin Biblias instaladas: estado vacío explícito ("No hay Biblias instaladas / Impórtala desde Bible") y sin selector visible.
- Carga de libros con manejo de error y estado propio ("No se pudo leer esta traducción").
- Mensajes de la búsqueda en tres estados: neutro mientras la referencia está incompleta ("Escribe una referencia, por ejemplo Juan 3:16"), error solo cuando hay libro + capítulo reconocibles pero inválidos, y resultado cuando el pasaje existe.
- Sincronización: la pantalla Bible y la consola comparten el mismo proveedor, así que importar o eliminar ya se refleja. Se añade una revalidación ligera de *metadata* al volver a la consola (al montar Live y al recuperar el foco de la ventana): solo la lista de traducciones, nunca el texto.

---

## 2. Quitar elementos del rundown

En `/projects/$projectId` la acción de quitar ya existe (subir, bajar, preset, eliminar con confirmación ligera) y la regla de dominio ya renormaliza el orden. Se revisa y se cubre con pruebas: quitar una canción o un pasaje no borra la canción ni la Biblia ni el texto guardado, el orden queda 0..n-1 y la fecha de modificación cambia.

**Nuevo: quitar desde Live.** Cada línea del rundown de la consola gana una acción secundaria "Quitar del rundown" (icono con etiqueta accesible, visible al pasar el cursor o con el teclado). Al usarla:

- se guarda el cambio en el proyecto;
- se quita ese elemento del show en curso de forma incremental (no se reconstruye el resto ni se incorporan cambios externos pendientes);
- si el elemento quitado no estaba al aire, Program no se toca.

Reordenar (subir/bajar) se mantiene como está en Projects y se refleja en la consola mediante la misma actualización incremental, sin recarga completa. Sin arrastrar y soltar.

### Caso clave: se quita el elemento que está al aire

La salida no se corta ni se pone en negro. La slide que está al aire se conserva como una *copia congelada* dentro del estado de la consola: el elemento desaparece del rundown, la salida sigue mostrando exactamente lo mismo, y no queda ninguna referencia interna apuntando a algo inexistente. En cuanto el operador manda otro contenido (clic en una slide, TAKE, siguiente/anterior), la copia congelada se descarta y Program vuelve a funcionar normalmente. Clear y Black siguen funcionando sobre esa copia.

---

## 3. Live sin monitor Preview

- Se elimina el panel visual de Preview. La columna derecha queda solo con Program, en 16:9 y más grande (la columna pasa de ~22 % a ~30 % del ancho, con la rejilla de slides manteniendo la prioridad).
- Preview sigue existiendo como estado interno: TAKE, siguiente/anterior y los atajos no cambian.
- En la rejilla se siguen distinguiendo los dos estados: la slide al aire y la slide seleccionada. Como un clic manda al aire, casi siempre coinciden; con teclado o TAKE pueden diferir.
- Los controles (Anterior, Siguiente, TAKE, Clear, Black, Buscar) siguen arriba y siempre visibles. La biblioteca Songs | Bible sigue abajo.

---

## Detalles técnicos

**Dominio / estado**
- `presentation.ts`: `PresentationState` gana `detachedProgramSlide?: Slide | null` (copia congelada del aire).
- `presentation-engine.ts`: nuevo `removePresentationItem(state, itemId)` — quita el item, renormaliza el runtime sin reconstruir los demás; si el item contenía la slide de Program, la copia a `detachedProgramSlide` y pone `programSlideId = null`; si contenía la selección, reubica Preview al vecino más cercano.
- `presentation-program.ts` / `presentation-live.ts`: `take` y `goLive` limpian `detachedProgramSlide`.
- `presentation-selectors.ts`: `getProgramSlide` y `getProgramOutput` devuelven la copia congelada cuando no hay `programSlideId`; `getProgramItem` devuelve `null` en ese caso.
- `presentation-store.ts`: expone `removePresentationItem(itemId)`.
- `live-session.ts`: `removeFromLiveSession` (simétrico a `appendToLiveSession`: quita el item, adopta la firma nueva, conserva el desfase externo previo) y `reorderLiveSession` para subir/bajar sin recarga.

**Bible**
- Nuevo `src/features/bible/use-bible-version-selection.ts` (selección/fallback/persistencia).
- `library-bible-tab.tsx`: estados neutro/error/resultado, manejo de error en la carga de libros, estado vacío sin selector.
- `bible-context.tsx`: expone `refreshVersions()` para la revalidación de metadata.

**UI**
- `live-monitors.tsx` → solo Program (se renombra a `live-program-monitor.tsx`).
- `_app.live.tsx`: nueva grilla `[rundown | slides | program]`, handler de quitar, revalidación de traducciones.
- `live-rundown.tsx`: acción "Quitar del rundown".
- `rundown-row.tsx` / `_app.projects.$projectId.tsx`: revisión de las acciones existentes.

**Pruebas nuevas (bun test)**
- Bible: lista de traducciones, autoselección con una, selector con varias, persistencia, fallback tras borrado, estado vacío, referencia parcial sin error, referencia válida, rango válido.
- Rundown: quitar canción y pasaje, la fuente original permanece, orden normalizado, `updatedAt` cambia, Live refleja la baja, Program intacto al quitar otro elemento, quitar el elemento al aire no corta la salida y no deja referencias inválidas.
- Live sin Preview visual: TAKE y navegación siguen funcionando, selección visible en la rejilla.
- Verificación en navegador: 1920×1080 y 1366×768, sin scroll global, consola limpia, salida sin regresiones.

**Riesgos de regresión**
- La copia congelada de Program es el punto más delicado: podría quedarse pegada si algún comando no la limpia. Se limpia en un único lugar (los comandos que cambian contenido de Program) y se cubre con pruebas.
- Quitar un elemento mientras cambia la selección puede dejar Preview en un item inexistente: la reubicación al vecino se prueba explícitamente.
- La baja incremental no debe "limpiar" un aviso de cambios externos pendientes, igual que el alta de la fase anterior.

**Fuera de alcance:** Media, arrastrar y soltar, contenido temporal, nube, Stage, Remote, búsqueda de texto en la Biblia, editar canciones desde Live.
