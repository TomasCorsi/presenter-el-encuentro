# Roadmap

Este documento es la ÚNICA fuente de verdad del roadmap y del estado de las
fases. No debe duplicarse en otros archivos.

## Regla

No comenzar una fase nueva hasta validar la anterior.

---

## Estado actual

- Fase actual completada: **Fase 6 — Live Mode**.
- Próxima fase: **Fase 7 — Output Main** (pendiente de aprobación).
- Backend: no conectado. Se decide en la Fase 13.
- Dependencias añadidas hasta la Fase 6: ninguna.
- Renumeración: Rundown pasa a ser la Fase 5 y las fases posteriores se
  desplazan una posición (Live Mode → Fase 6, …, Supabase → Fase 13).
- Implementado hasta ahora: documentación en `/docs`, tema oscuro con tokens
  semánticos, App Shell, gestión local completa de Projects, biblioteca de
  Songs con editor de secciones y autoguardado, Presentation Engine como
  dominio puro con store vanilla, y la consola Live con Preview, Program,
  TAKE, Clear/Black y atajos de teclado.
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
- [ ] Añadir a proyecto (cuando Projects y Songs se integren).

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

- [ ] `/output/main`.
- [ ] Sin controles.
- [ ] Sincronizado con Presentation Engine.
- [ ] Fullscreen.
- [ ] Performance.

---

## Fase 8 — Presets

- [ ] Biblioteca.
- [ ] Editor.
- [ ] Background.
- [ ] Typography.
- [ ] Alignment.
- [ ] Position.
- [ ] Logo.
- [ ] Transition.

---

## Fase 9 — Bible

- [ ] Versiones.
- [ ] Libros.
- [ ] Capítulos.
- [ ] Versículos.
- [ ] Rangos.
- [ ] Buscar.
- [ ] Presentar.
- [ ] Presets.

---

## Fase 10 — Media

- [ ] Images.
- [ ] Videos.
- [ ] Audio.
- [ ] Logos.
- [ ] Thumbnails.
- [ ] Metadata.
- [ ] Offline-ready.

---

## Fase 11 — Stage + Stream Outputs

- [ ] `/output/stage`.
- [ ] `/output/stream`.
- [ ] Layouts independientes.
- [ ] Current/next slide.
- [ ] Clock.
- [ ] Countdown.

---

## Fase 12 — PWA + Offline

- [ ] Manifest.
- [ ] Service Worker.
- [ ] Offline shell.
- [ ] IndexedDB.
- [ ] Cache strategy.
- [ ] Download for offline.
- [ ] Update strategy.

---

## Fase 13 — Supabase

- [ ] Auth.
- [ ] Workspaces.
- [ ] PostgreSQL.
- [ ] Storage.
- [ ] RLS.
- [ ] Variables de entorno.

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
