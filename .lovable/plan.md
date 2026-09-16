# Fase 1 — App Shell + Design System

Objetivo: una aplicación navegable, con aspecto de software profesional de producción audiovisual, sin funcionalidades reales de presentación.

## 1. Tema oscuro y tokens

`src/styles.css` pasa a tener el tema oscuro como base de la aplicación (superficies neutras frías, contraste alto, radios contenidos).

Tokens nuevos según el mapeo ya acordado en el design system: `live`, `success`, `warning`, `offline` (más sus variantes de texto). `danger` reutiliza `destructive`, `surface` reutiliza `card`, `surfaceElevated` reutiliza `popover`.

Regla que se respeta en todo el código: ningún color literal en los componentes, solo clases semánticas (ADR-009).

Tipografía sans-serif legible cargada con un `<link>` en la raíz, más una familia monoespaciada para valores técnicos (tiempos, atajos, estados).

## 2. App Shell

- Ruta de layout que envuelve las pantallas de la aplicación y deja fuera los futuros `/output/*` y `/remote`.
- Sidebar fija en escritorio, colapsable a franja de iconos, con menú deslizante en pantallas pequeñas.
- Topbar con espacio para nombre del workspace, proyecto activo, estado de conexión y perfil.
- Área de contenido con scroll propio y ancho máximo cómodo.

Todo el estado mostrado (workspace, usuario, online/offline/sync) es visual y estático en esta fase; nada de sincronización real.

## 3. Sidebar

Grupos:

```text
Principal      Home · Projects · Songs · Bible · Media · Presets
Producción     Live · Outputs
Sistema        Settings
```

Pie de la barra: workspace actual, usuario y un indicador de estado Online / Offline / Sync como distintivo visual. La sección activa se resalta siguiendo la ruta actual.

## 4. Rutas

Se crean las nueve rutas en la misma tanda, cada una con su propio título y descripción para compartir y buscar:

```text
/  /projects  /songs  /bible  /media  /presets  /live  /outputs  /settings
```

Cada pantalla es una página de estado vacío coherente: título de sección, descripción corta y un aviso de que la funcionalidad llega en su fase. `Home` muestra un panel de bienvenida sobrio con accesos a las secciones. Sin datos inventados ni listados falsos.

## 5. Componentes base

Se añaden solo los que el shell usa de verdad: `StatusBadge` (live / online / offline / sync), `EmptyState` y `PageHeader`. El resto del catálogo del design system se irá creando cuando su fase lo pida, para evitar sobreingeniería.

## Detalles técnicos

- Estructura: `src/routes/` para el enrutado por archivos, `src/components/layout/` para shell, sidebar y topbar, `src/components/ui/` para los componentes base. Sin carpetas vacías.
- Layout mediante ruta pathless (`_app`) para que los outputs futuros no hereden el shell. Las URL no cambian.
- El estado de colapso de la barra y cualquier lectura del navegador se ejecuta solo tras la hidratación, según las reglas SSR de la Fase 0.
- Navegación siempre con los enlaces tipados del router, nunca `<a href>` interno.
- Cero dependencias nuevas.
- TypeScript estricto, props tipadas, componentes cortos, sin lógica de negocio en la UI.

## Fuera de alcance

Supabase, PWA, IndexedDB, Presentation Engine, Songs, Bible, Media, Presets, Outputs reales, sincronización y Remote.

## Documentación

Al terminar se actualiza únicamente `/docs/ROADMAP.md`: sección "Estado actual" y marcado de las tareas de Fase 1. Si el tema oscuro introduce tokens no previstos, se refleja en `/docs/DESIGN_SYSTEM.md`.

## Riesgos

- El aspecto "profesional" es subjetivo: tras la primera versión conviene una ronda de ajuste visual.
- Una barra lateral densa puede competir con el espacio de trabajo en portátiles pequeños; por eso se contempla el colapso desde el inicio.
