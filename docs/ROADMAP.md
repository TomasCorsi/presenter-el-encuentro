# Roadmap

Este documento es la ÚNICA fuente de verdad del roadmap y del estado de las
fases. No debe duplicarse en otros archivos.

## Regla

No comenzar una fase nueva hasta validar la anterior.

---

## Estado actual

- Última fase completada: **Fase 11.2 — Stream Output transparente**; su
  validación manual OBS/vMix permanece pendiente y no se registra como PASS.
- Fases 10.1, 10.2, 10.3, 11.1 y 11.2 tienen implementación y build completos
  según sus respectivos gates documentados.
- **Fase 12 — PWA + Offline:** implementación, Quality Gate automático y build
  completos; la validación manual permanece pendiente y fue aceptada
  temporalmente como riesgo conocido para iniciar Fase 13.
- **Fase 13 — Supabase:** COMPLETADA. Infraestructura cloud opcional, migración
  remota, RLS real, pgTAP, Auth básica y repositories validados contra el
  proyecto `yadwnoqjexrrtklhfgcq`. IndexedDB continúa siendo la autoridad
  operativa; recovery end-to-end y SMTP productivo quedan pendientes no
  bloqueantes.
- Renumeración: Rundown pasa a ser la Fase 5 y las fases posteriores se
  desplazan una posición (Live Mode → Fase 6, …, Supabase → Fase 13).
- Implementado hasta ahora: Projects/Rundown, Songs, Presentation Engine,
  Live, Output Main, Presets, Bible, selección de proyector y Media local para
  imágenes/videos con playback sincronizado.
- Ancho de página: lo decide cada pantalla (`contained` o `full`), no el shell.
- Tipografía: stack del sistema, sin fuentes externas (offline-first).
- Dirección visual: superficie de control broadcast, con jerarquía operativa,
  estados vacíos compactos y Home organizado como centro de producción.

---

## Fase 0 — Arquitectura y documentación

### Objetivo

Definir la base técnica y funcional del proyecto.

### Tareas

- [x] Crear documentación.
- [x] Definir arquitectura.
- [x] Definir modelo de dominio.
- [x] Definir design system inicial.
- [x] Definir estrategia offline.
- [x] Registrar decisiones iniciales.

### Fuera de alcance

- Supabase.
- PWA.
- IndexedDB real.
- Presentation Engine.
- Songs.
- Bible.
- Media.
- Outputs.

### Criterios de aceptación

- [x] La documentación existe.
- [x] La arquitectura está definida.
- [x] El roadmap está documentado.
- [x] Las decisiones principales están registradas.

### Estado

- [x] Completada

---

## Fase 1 — App Shell + Design System

### Objetivo

Crear la estructura visual y de navegación.

### Tareas

- [x] Layout (`src/routes/_app.tsx`, ruta pathless: los outputs no lo heredan).
- [x] Sidebar (grupos Principal / Producción / Sistema, colapsable a iconos).
- [x] Topbar (workspace, proyecto activo, conexión, perfil).
- [x] Routing (nueve rutas con metadatos propios).
- [x] Tema oscuro con tokens `live`, `success`, `warning`, `offline`.
- [x] Componentes UI base: `StatusBadge`, `EmptyState`, `Page` / `PageHeader`.
- [x] Responsive foundation (verificado en 1920x1080, 1366x768 y móvil).

### Pantallas

- [x] Home.
- [x] Projects.
- [x] Songs.
- [x] Bible.
- [x] Media.
- [x] Presets.
- [x] Live.
- [x] Outputs.
- [x] Settings.

### Estado

- [x] Completada

Todas las pantallas son estados vacíos. El estado Online / Offline / Sync es
visual: no existe sincronización real.

---

## Fase 1.1 — Refinamiento visual del App Shell

### Objetivo

Elevar la calidad visual y la legibilidad del shell sin modificar arquitectura,
routing, comportamiento ni alcance funcional.

### Tareas

- [x] Refinar jerarquía, densidad, superficies y bordes.
- [x] Refinar sidebar expandida y colapsada.
- [x] Convertir la topbar en barra de contexto operativo.
- [x] Reorganizar Home como centro de producción sin funciones nuevas.
- [x] Convertir los estados vacíos en bloques compactos e integrados.
- [x] Mantener tokens semánticos y fuentes locales del sistema.
- [x] Verificar navegación, teclado y viewports de escritorio.

### Estado

- [x] Completada

No se añadieron funcionalidades, rutas, dependencias ni datos técnicos ficticios.

---

## Fase 2 — Projects

- [x] Crear, listar, abrir y buscar proyectos.
- [x] Renombrar, duplicar y eliminar con confirmación.
- [x] Seleccionar y mostrar el proyecto activo en Projects, Home y Topbar.
- [x] Mostrar fechas de creación y última modificación.
- [x] Añadir `/projects/$projectId` con detalle y placeholder de Rundown.
- [x] Persistencia temporal en `localStorage` detrás de un repository async.
- [x] Tests de reglas de negocio y persistencia con el runner de Bun.

### Estado

- [x] Completada

El rundown funcional y drag & drop no pertenecen a esta fase; permanecen en la
Fase 5. IndexedDB continúa diferido a la Fase 12.

---

## Fase 3 — Songs

- [x] Biblioteca.
- [x] Crear.
- [x] Editar.
- [x] Secciones.
- [x] Buscar.
- [x] Slides (Fase 4, Presentation Engine).
- [x] Añadir a proyecto mediante Rundown.

---

## Fase 4 — Presentation Engine

- [x] Modelo de runtime (`Slide`, `PresentationItem`, `PresentationRuntime`).
- [x] Runtime derivado explícito (`buildPresentationRuntime`), sin caches ocultos.
- [x] Comandos puros: load, reset, selectItem, selectSlide, next, previous,
      goToFirst, goToLast.
- [x] Selectores derivados: current item/slide, índices, next/previous slide.
- [x] Navegación entre items, sin wrap en los extremos.
- [x] Semántica de items sin slides e IDs inválidos como no-op.
- [x] Transformación pura Song → PresentationItem (una sección = una slide).
- [x] Store vanilla framework-agnóstico + provider React con SSR snapshot.
- [x] Tests del motor (`bun test`).
- [ ] Clear / Black / Logo → estado de salida, corresponde a Live / Outputs.

### Estado

- [x] Completada

Sin UI: el motor no se consume todavía desde ninguna pantalla. Preview y
Program continúan unificados en una sola posición (ADR-017).

---

## Fase 5 — Project Rundown / Composition

- [x] `rundown: RundownItem[]` embebido en Project; `itemIds` eliminado.
- [x] Migración `broadcast-control.projects.v1` → `v2`, conservando v1.
- [x] Identidad de instancia (`id`) separada del origen (`sourceId`).
- [x] Agregar canciones desde `/projects/$projectId` con panel de búsqueda.
- [x] Misma Song repetible dentro del mismo rundown.
- [x] Reordenar con botones subir/bajar y eliminar con confirmación.
- [x] Referencias rotas conservadas como contenido faltante.
- [x] Aviso al eliminar una Song en uso (advertir, no bloquear).
- [x] `projectToPresentation` puro, reutilizando `songToPresentationItem`.
- [x] Tests de rundown, migración y conversión (`bun test`).
- [ ] Drag & drop: diferido, sin dependencias nuevas.

### Estado

- [x] Completada

Sin Live ni Outputs: la conversión a `PresentationItem[]` existe y está
probada, pero la UI todavía no carga el Presentation Engine. Eliminar un item
del rundown afecta solo a esa instancia y nunca a la Song original; volver a
agregarla genera otro `itemId` y no restaura la posición anterior.

---

## Fase 6 — Live Mode

- [x] Rundown de solo lectura sobre el show cargado.
- [x] Preview y Program separados (`previewSlideId` / `programSlideId`).
- [x] Slide grid del item seleccionado, con marca de Preview y de Program.
- [x] Controles Previous / Next / TAKE / Clear / Black.
- [x] Atajos: ← anterior, → siguiente, Enter o Espacio para TAKE.
- [x] Snapshot explícito del Project activo, con aviso de contenido
      actualizado y recarga manual.
- [x] Tests de Program, load/reload y composición del snapshot.
- [ ] Logo: diferido hasta Presets/Media.
- [ ] Persistencia del estado live: fuera de alcance.

### Estado

- [x] Completada

Sin `/output/main`, sin BroadcastChannel y sin persistencia: recargar la
página reinicia la sesión en vivo. Live nunca edita el rundown, y el cambio de
Project activo no altera el show en curso sin acción del operador.

---

## Fase 7 — Output Main

- [x] `/output/main` fuera del App Shell, viewport completo, sin scroll.
- [x] Sin controles ni chrome: solo representa Program (overlay efímero de fullscreen).
- [x] Sincronización Live → Output mediante Output Sync (BroadcastChannel detrás de `OutputTransport`, ADR-027/028).
- [x] `OutputSnapshot` resuelto (`mode` + `slide.id` + `slide.lines`); Preview nunca se transmite.
- [x] `sessionId` efímero con vinculación de sesión y `sequence` por sesión (ADR-029).
- [x] Heartbeat 2 s / timeout 5 s; `bye` como optimización; salida segura en negro puro.
- [x] Fullscreen manual (botón overlay, doble clic); cursor oculto tras inactividad.
- [x] Múltiples Outputs simultáneos; "Abrir Output" desde Live.

---

## Fase 8 — Presets

- [x] Modelo `Preset` separado del contenido (ADR-032).
- [x] Default Preset reservado `preset-default`, no editable ni eliminable, duplicable (ADR-033).
- [x] `presetId` opcional por aparición del rundown, con fallback al Default (ADR-034).
- [x] Biblioteca `/presets`: crear, abrir, renombrar, duplicar, eliminar, buscar.
- [x] Editor `/presets/$presetId` con vista previa 16:9 en vivo y autoguardado.
- [x] Tipografía (stacks locales), tamaño, peso, alineación H/V, color, fondo sólido y safe area.
- [x] Renderer compartido por Live Preview, Live Program, Output Main y el editor (ADR-035).
- [x] Estilo resuelto y congelado en el snapshot de Live y en `OutputSnapshot` (ADR-036).
- [x] Decisión cerrada: Media es contenido, no background de Preset (ADR-048).
- [ ] Logo.
- [ ] Transition.

---

## Fase 8.1 — Auto-advance de Program dentro del item al aire

- [x] Comandos operativos `nextLive` / `previousLive` en dominio (ADR-037).
- [x] Next/Previous arrastran Program dentro del item al aire, sin TAKE.
- [x] Cruzar de item mueve solo Preview: cambiar de item exige TAKE.
- [x] `clear` / `black` conservan el modo mientras avanza `programSlideId`.
- [x] Teclado (← / →) con la misma semántica; sin toggle ni configuración.

---

## Fase 8.2 — Rediseño del espacio de trabajo Live

- [x] Layout de tres zonas: rundown, rejilla de slides y monitores.
- [x] Program siempre visible con Preview compacto debajo.
- [x] Barra de controles fija a alto de ventana, sin scroll global.
- [x] Estados Preview/Program con etiqueta textual además del color.
- [x] Anchos flexibles (`clamp`) verificados en 1920×1080 y 1366×768.
- [x] Sin cambios en Presentation Engine, Output Sync, Presets ni Projects.

---

## Fase 9 — Bible

Completada.

- [x] Importación local de Biblias desde archivo `.json` (sin red, sin backend).
- [x] Capa de adaptadores `ExternalBibleJson → BibleImportAdapter → CanonicalBible`.
- [x] Instalación y lectura offline en IndexedDB (`BibleRepository`).
- [x] Listado de traducciones instaladas con Abrir y Eliminar.
- [x] Navegación libro → capítulo → versículo y selección de rango.
- [x] Búsqueda por referencia tolerante (`jn 3:16-18`, acentos, abreviaturas).
- [x] Vista previa del pasaje con el renderer compartido.
- [x] Pasaje agregado al Rundown como snapshot autosuficiente.
- [x] Un versículo = una slide, con líneas originales y referencia secundaria.
- [x] Presets aplicables al item Bible igual que a una Song.
- [x] Live y Output sin conocer Bible ni IndexedDB.
- [x] Eliminar una traducción no rompe los pasajes ya agregados.

---

## Fase 9.1 — Live Operator Workspace

Completada.

- [x] Un clic en una slide la envía al aire (`goLive`), saliendo de Clear/Black.
- [x] Clic en un RundownItem sigue moviendo solo Preview.
- [x] Barra de operación fija arriba: Previous, Next, TAKE, Clear, Black, Buscar.
- [x] Library Dock operativo abajo, colapsable y con scroll propio.
- [x] Pestañas Songs, Bible y Media reutilizando las fuentes existentes.
- [x] Dos acciones explícitas por resultado: "Rundown" y "Al aire".
- [x] Alta incremental (`appendPresentationItem`) sin recargar la presentación.
- [x] Sin items temporales: todo lo agregado queda en el Project activo.
- [x] Sin Project activo se puede buscar, pero no agregar.
- [x] El aviso de desfase externo se conserva al agregar contenido.
- [x] Atajos: ←, →, Enter/Space, B, C, `/`, Esc; ignorados al escribir.
- [x] Preferencia local del dock (abierto, pestaña, versión) fuera del Project.

---

## Fase 9.2 — Baja incremental y salida congelada

Completada.

- [x] Quitar apariciones desde Live sin reconstruir el show.
- [x] Songs/Bible al aire sobreviven mediante `detachedProgramSlide`.
- [x] Media al aire no se puede quitar hasta cambiar Program.
- [x] El desfase externo pendiente se conserva.

---

## Fase 9.3 — Output sobre proyector

Completada.

- [x] Detección y selección conservadora de pantalla.
- [x] Preferencia local y manejo de pantalla desconectada.
- [x] Reutilización de la ventana `audience-main`.
- [x] Fullscreen manual y pantalla de prueba.

---

## Fase 10 — Media

- [x] Imágenes PNG/JPEG/WEBP.
- [x] Videos MP4/WEBM con compatibilidad de códec dependiente del navegador.
- [x] Thumbnails y metadata visual.
- [x] Metadata en IndexedDB y bytes en OPFS; fallback Blob para imágenes.
- [x] Project Detail, Library Dock, Live y Output Main.
- [x] Playback autoritativo con play/pause/restart/loop.
- [x] Persistent storage best-effort y no bloqueante.
- [x] Tests automatizados de dominio, servicios y storage.
- [x] Quality Gate manual cerrado en Chrome sobre Windows: MP4 compatible,
      metadata, OPFS tras reload/reapertura, independencia del archivo original,
      estado `not-persistent`, Program muted y controles de playback.

**Estado:** COMPLETADA (2026-09-24). Las comprobaciones manuales no ejecutadas
fueron aceptadas como riesgo residual y permanecen detalladas en `TESTING.md`;
no se registran como PASS.

**Fuera de alcance de esta fase:** audio assets, logos y backgrounds Media.

---

## Fase 10.1 — Media Preview + Backgrounds Dinámicos

- [x] Preview local de imagen/video en `/media` y en el dock de Live.
- [x] Background Media por aparición Song/Bible, separado de `PresetStyle`.
- [x] Fondo sólido del Preset como base y fallback congelado.
- [x] `PresentationSurface` por capas: Background + Content.
- [x] Videos decorativos muted, loop, autoplay y sin playback autoritativo.
- [x] Quick Background Deck: Sin fondo, búsqueda, favoritos, recientes y Preview-first.
- [x] Cut inmediato y Fade local de 500 ms, sin timeline entre ventanas.
- [x] Replace incremental de un solo `PresentationItem` desde Live.
- [x] Uso y protección de borrado extendidos a backgrounds Song/Bible.
- [x] Thumbnails visuales Song/Bible en Live con estilo y background resueltos;
      los videos usan frame estático y nunca abren bytes por card.
- [x] 314 tests, typecheck, lint dirigido y build de producción.
- [x] Gate incremental de thumbnails: 323 tests, typecheck, lint dirigido y
      build de producción PASS.
- [ ] Quality Gate visual final en Chrome/Edge sobre Windows real.

**Estado:** IMPLEMENTACIÓN COMPLETA / VALIDACIÓN MANUAL PENDIENTE (2026-09-25).
El control visual pendiente permanece registrado en `TESTING.md` como riesgo
residual histórico.

---

## Fase 10.2 — Operator Workspace

- [x] Toolbar única con Project, estado de Output, Previous, Next, TAKE, Clear,
      Black, Buscar, Abrir Output y Fullscreen.
- [x] Preview visual dominante y Program siempre visible, ambos 16:9 y basados
      en los renderers compartidos existentes.
- [x] Slide Strip horizontal con Visual Slide Thumbnails, sin compresión y con
      indicadores Preview/Program superpuestos.
- [x] Interacción segura: clic prepara Preview; doble clic, Enter o Space
      seleccionan la slide correcta y la envían a Program; TAKE usa el Preview
      actual.
- [x] Rundown tipo playlist con tipo, estados independientes, eliminación y
      reordenamiento incremental.
- [x] Reorder preserva IDs, Preview, Program, `programMode`, Program detached,
      playback de video, `staleExternal` y el Output visual vigente.
- [x] Library Dock existente preservado con resize, bounds, persistencia y
      restauración; inicio colapsado en compact/short sin preferencia previa.
- [x] Responsive notebook-first con perfil compact hasta 880 px, Preview
      dominante, Program legible y sin scroll global.
- [x] Componentes legacy `LiveShowBar`, `LiveOperationBar` y `LiveSlideGrid`
      retirados sin referencias residuales.
- [x] Quality Gate final: 356 tests PASS, typecheck PASS, build PASS y lint
      dirigido sin errores.

**Estado:** COMPLETADA (2026-10-03).

---

## Fase 10.3 — Media Library organizada

- [x] `MediaAsset` retrocompatible con colección, tags y revisión
      `presentationUpdatedAt` separada de la metadata general.
- [x] IndexedDB Media v2 con store `collections`, CRUD, unicidad normalizada y
      desasignación transaccional al eliminar una colección.
- [x] Preferencias locales compartidas de favoritos, actividad MRU y densidad,
      con migración única desde Background Deck.
- [x] Búsqueda AND por nombre/tags/colección, filtros y ordenamientos sin leer
      bytes ni montar videos en la grilla.
- [x] `/media` con sidebar/selector de colecciones, grid/compacto, importación a
      colección, inspector lateral y selección múltiple.
- [x] Bulk move/tags/favoritos/delete; preflight completo de referencias y
      reporte explícito de resultados parciales tras fallos físicos.
- [x] Media Dock y Quick Background Deck integrados con búsqueda, colecciones,
      favoritos y actividad compartida.
- [x] Firma de Live dependiente exclusivamente de `presentationUpdatedAt`.
- [x] 370 tests PASS, typecheck PASS y lint dirigido sin errores.
- [x] Build de producción PASS (client, SSR y Nitro/Cloudflare).
- [x] Migración real v1→v2 y checks principales de `/media` y Live validados
      en Chrome 153 sobre un perfil aislado con 302 assets legacy y bytes OPFS.
- [ ] Autocompletado de tags: pendiente no bloqueante. La implementación actual
      conserva un input libre normalizado y no ofrece sugerencias.

**Estado:** COMPLETADA (2026-10-13). El autocompletado de tags fue retirado
explícitamente del criterio bloqueante y permanece como mejora futura.

---

## Fase 11 — Stage + Stream Outputs

- [x] `/output/stage` read-only, fuera del App Shell.
- [x] Proyección aditiva `stage?: StageProjection` en el protocolo existente.
- [x] Current derivado de Program y next global navegable, sin usar Preview.
- [x] Song, Bible y Media estático; Clear/Black conservan las cues visibles.
- [x] Late-open, session/sequence, heartbeat, stale con último snapshot y reloj.
- [x] Fullscreen compartido y ventanas Main/Stage independientes desde Live.
- [x] `/output/stream` transparente, read-only y fuera del App Shell.
- [x] Relay HTTP/SSE efímero para Browser Source/Web Browser Input en loopback.
- [x] Lower third Song/Bible; Media, backgrounds, Clear y Black transparentes.
- [x] Layout Stage independiente.
- [x] Current/next slide para Stage.
- [x] Clock local para Stage.
- [ ] Countdown.

**Estado Fase 11.1:** IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO /
VALIDACIÓN MANUAL PENDIENTE (2026-10-13). Client build, SSR build y Nitro con
preset `cloudflare-module` pasan; suite, typecheck, lint dirigido y
`git diff --check` también pasan. No se realizó ni se registra validación manual.
Fase 11.2 / Stream implementada; quality gate automático y build completos.

**Estado Fase 11.2:** IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO /
BUILD PASS / VALIDACIÓN MANUAL OBS/VMIX PENDIENTE (2026-10-16).
La salida usa alpha real en Browser Source/Web Browser Input y un relay local de
proceso único limitado a loopback. Media no se renderiza y Clear, Black y stale
dejan el overlay transparente. Main y Stage permanecen independientes. Window
Capture no está soportado para alpha. La fase siguiente no fue iniciada.

---

## Fase 12 — PWA + Offline

- [x] Manifest instalable “Presenter El Encuentro” e iconos locales.
- [x] Service Worker `injectManifest`, registrado únicamente en cliente.
- [x] Offline shell y documentos críticos versionados.
- [x] IndexedDB `broadcast-control.app` para Projects, Songs y Presets.
- [x] Migración transaccional e idempotente sin borrar claves legacy.
- [x] Bible, Media metadata y bytes OPFS conservan sus almacenes actuales.
- [x] Matriz de caché explícita; APIs, relay/SSE y métodos mutables son Network Only.
- [x] Main y Stage disponibles offline; Stream no simula el relay ausente.
- [x] Actualizaciones en espera, sin reload automático y bloqueadas con ventanas operativas.
- [x] Instalación, red y diagnósticos de almacenamiento en Settings.
- [x] Build client/SSR/Nitro.
- [ ] Validación manual de instalación, migración real y arranque offline.

**Estado:** IMPLEMENTACIÓN COMPLETA / QUALITY GATE AUTOMÁTICO COMPLETO / BUILD
PASS / VALIDACIÓN MANUAL PENDIENTE (2026-11-03). Client, SSR y Nitro con preset
`cloudflare-module` pasan; el artefacto público contiene manifest, iconos y
Service Worker `injectManifest` con los assets versionados. No se realizó ni se
registra validación manual.

---

## Fase 13 — Supabase

- [x] Cliente browser-only opcional y variables públicas de entorno.
- [x] Auth email/password, sesión, recovery y logout no destructivo.
- [x] Perfil, workspace personal y memberships owner/operator.
- [x] PostgreSQL para Projects, Songs y Presets con JSONB versionado.
- [x] Repositories cloud separados, sin consumidores operativos ni dual-write.
- [x] RLS, grants mínimos, auditoría, triggers e índices.
- [x] Settings Cuenta/Nube y estado cloud no bloqueante.
- [x] Tests app y pgTAP creados.
- [x] Build client, SSR y Nitro `cloudflare-module`.
- [x] pgTAP real remoto: 15/15 mediante MCP oficial, sin Docker.
- [x] Supabase real: migración, RLS, Auth básica y repositories.
- [ ] Recovery end-to-end y SMTP productivo (pendiente no bloqueante).

**Estado:** FASE 13 COMPLETADA / MIGRACIÓN CLOUD PASS / RLS REAL PASS / pgTAP
15/15 PASS / REPOSITORIES CLOUD PASS / AUTH BÁSICA REAL PASS / BUILD PASS.
Supabase no sincroniza ni reemplaza IndexedDB. Media, Bible, preferencias,
Live y Outputs permanecen locales. Supabase Storage y Realtime no se usan.

Quality gate final del 2026-11-04:

- proyecto verificado: `yadwnoqjexrrtklhfgcq`;
- seis tablas con RLS, 17 policies, 8 triggers y 14 índices verificados;
- anon bloqueado y aislamiento cross-workspace A/B: PASS;
- RPC e idempotencia para dos usuarios independientes: PASS;
- Projects/Songs/Presets `put/get/list/delete`: PASS contra cloud real;
- Auth login/logout, persistencia, refresh y reconnect: PASS;
- signup alcanzó Auth real pero quedó limitado por rate limit de email; recovery
  end-to-end también quedó pendiente por `429 over_email_send_rate_limit`;
- email confirmation activa; SMTP productivo no validado;
- pgTAP remoto: 15/15 PASS;
- tests focalizados cloud/Auth/PWA: 20 PASS, 0 FAIL, 102 assertions;
- suite completa: 428 PASS, 0 FAIL, 1212 assertions en 80 archivos;
- TypeScript, lint dirigido y `git diff --check`: PASS;
- build client, SSR y Nitro `cloudflare-module`: PASS;
- cliente Supabase browser-only y configuración ausente: SSR-safe.

No se importaron datos locales, no se conectaron repositories cloud a providers
operativos y todo el contenido QA remoto fue eliminado. Sync sigue reservado
para Fase 14 y Supabase no es backup.

---

## Fase 14 — Sync Engine

- [ ] Local → Cloud.
- [ ] Cloud → Local.
- [ ] Cola offline.
- [ ] Retry.
- [ ] Conflictos básicos.
- [ ] Sin bloquear Live.

---

## Fase 15 — Backups

- [ ] Export workspace.
- [ ] Import workspace.
- [ ] Backup.
- [ ] Restore.
- [ ] Migración entre PCs.

---

## Fase 16 — Mobile Remote

- [ ] `/remote`.
- [ ] Diseño móvil dedicado.
- [ ] Previous.
- [ ] Next.
- [ ] Clear.
- [ ] Black.
- [ ] Logo.
- [ ] Navegación de slides.

---

## Fase 17 — Optimización

- [ ] Performance audit.
- [ ] Accessibility audit.
- [ ] Bundle optimization.
- [ ] Rendering optimization.
- [ ] Error handling.
- [ ] UX polish.
- [ ] Testing.
