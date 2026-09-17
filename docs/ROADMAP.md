# Roadmap

Este documento es la ÚNICA fuente de verdad del roadmap y del estado de las
fases. No debe duplicarse en otros archivos.

## Regla

No comenzar una fase nueva hasta validar la anterior.

---

## Estado actual

- Fase actual completada: **Fase 2 — Projects**.
- Próxima fase: **Fase 3 — Songs** (pendiente de aprobación).
- Backend: no conectado. Se decide en la Fase 12.
- Dependencias añadidas hasta la Fase 2: ninguna.
- Implementado hasta ahora: documentación en `/docs`, tema oscuro con tokens
  semánticos, App Shell y gestión local completa de Projects con proyecto activo,
  búsqueda, detalle y persistencia temporal aislada detrás de un repository.
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
Fase 5. IndexedDB continúa diferido a la Fase 11.

---

## Fase 3 — Songs

- [ ] Biblioteca.
- [ ] Crear.
- [ ] Editar.
- [ ] Secciones.
- [ ] Slides.
- [ ] Buscar.
- [ ] Añadir a proyecto.

---

## Fase 4 — Presentation Engine

- [ ] Current slide.
- [ ] Next.
- [ ] Previous.
- [ ] Clear.
- [ ] Black.
- [ ] Logo.
- [ ] Tests del motor.

---

## Fase 5 — Live Mode

- [ ] Rundown.
- [ ] Preview.
- [ ] Program.
- [ ] Slide grid.
- [ ] Controles.
- [ ] Keyboard shortcuts.
- [ ] Estado Live.

---

## Fase 6 — Output Main

- [ ] `/output/main`.
- [ ] Sin controles.
- [ ] Sincronizado con Presentation Engine.
- [ ] Fullscreen.
- [ ] Performance.

---

## Fase 7 — Presets

- [ ] Biblioteca.
- [ ] Editor.
- [ ] Background.
- [ ] Typography.
- [ ] Alignment.
- [ ] Position.
- [ ] Logo.
- [ ] Transition.

---

## Fase 8 — Bible

- [ ] Versiones.
- [ ] Libros.
- [ ] Capítulos.
- [ ] Versículos.
- [ ] Rangos.
- [ ] Buscar.
- [ ] Presentar.
- [ ] Presets.

---

## Fase 9 — Media

- [ ] Images.
- [ ] Videos.
- [ ] Audio.
- [ ] Logos.
- [ ] Thumbnails.
- [ ] Metadata.
- [ ] Offline-ready.

---

## Fase 10 — Stage + Stream Outputs

- [ ] `/output/stage`.
- [ ] `/output/stream`.
- [ ] Layouts independientes.
- [ ] Current/next slide.
- [ ] Clock.
- [ ] Countdown.

---

## Fase 11 — PWA + Offline

- [ ] Manifest.
- [ ] Service Worker.
- [ ] Offline shell.
- [ ] IndexedDB.
- [ ] Cache strategy.
- [ ] Download for offline.
- [ ] Update strategy.

---

## Fase 12 — Supabase

- [ ] Auth.
- [ ] Workspaces.
- [ ] PostgreSQL.
- [ ] Storage.
- [ ] RLS.
- [ ] Variables de entorno.

---

## Fase 13 — Sync Engine

- [ ] Local → Cloud.
- [ ] Cloud → Local.
- [ ] Cola offline.
- [ ] Retry.
- [ ] Conflictos básicos.
- [ ] Sin bloquear Live.

---

## Fase 14 — Backups

- [ ] Export workspace.
- [ ] Import workspace.
- [ ] Backup.
- [ ] Restore.
- [ ] Migración entre PCs.

---

## Fase 15 — Mobile Remote

- [ ] `/remote`.
- [ ] Diseño móvil dedicado.
- [ ] Previous.
- [ ] Next.
- [ ] Clear.
- [ ] Black.
- [ ] Logo.
- [ ] Navegación de slides.

---

## Fase 16 — Optimización

- [ ] Performance audit.
- [ ] Accessibility audit.
- [ ] Bundle optimization.
- [ ] Rendering optimization.
- [ ] Error handling.
- [ ] UX polish.
- [ ] Testing.
