# Fase 7.1 — Navegación instantánea entre secciones

## Causa raíz (confirmada por lectura de código)

No es el enrutador ni una animación: todas las rutas están en el mismo bundle, ninguna tiene `loader`, `pendingComponent` ni `Suspense`, el sidebar ya usa `Link` (no `<a href>`, así que no hay recarga de documento) y no existe transición CSS sobre el contenido.

El retraso viene de dos cosas:

1. **`SongsProvider` se monta por ruta, no una sola vez.**
   - `src/routes/_app.projects.tsx:9-15` monta su propio `SongsProvider`.
   - `src/routes/_app.songs.tsx:9-15` monta otro.
   - `src/routes/_app.live.tsx:59-65` monta un tercero.
   Al cambiar entre Projects, Songs y Live, React desmonta y vuelve a montar el provider: se pierde todo lo que ya estaba en memoria.

2. **Cada montaje vuelve a leer y validar localStorage y muestra un texto de carga que tapa la pantalla.**
   - `songs-context.tsx:33,66-68` y `projects-context.tsx:32,67-69` arrancan en `loading: true` y cargan dentro de un efecto.
   - `_app.projects.index.tsx:47`, `_app.songs.index.tsx:58` y `_app.live.tsx:100-102` reemplazan todo el contenido por "Cargando…" mientras `loading` es true.

Resultado: en cada visita a Projects/Songs/Live aparece un parpadeo con texto de carga aunque los datos ya se hubieran leído antes.

## Qué se va a cambiar

### 1. Un solo provider estable en el App Shell
- Montar `SongsProvider` una única vez en `src/routes/_app.tsx`, junto a `ProjectsProvider`, dentro del shell y por encima del `<Outlet />`.
- Eliminar los `SongsProvider` de `_app.projects.tsx`, `_app.songs.tsx` y `_app.live.tsx`.
- `_app.projects.tsx` y `_app.songs.tsx` quedan como layouts que solo devuelven `<Outlet />` (o se eliminan si dejan de aportar). `_app.live.tsx` conserva `PresentationProvider`, que sí es propio de Live.
- Con esto, AppShell, sidebar, topbar y ambos providers dejan de remontarse al navegar.

### 2. La lectura de almacenamiento ocurre una sola vez
- La carga inicial sigue en un efecto (seguro para SSR), pero al no remontarse el provider se ejecuta una sola vez por sesión de app.
- No se agregan lecturas nuevas ni se bloquea la navegación: los datos ya cargados permanecen en memoria.

### 3. Sin pantalla de carga entre secciones
- Diferenciar "primera carga" de "ya cargado": las páginas solo muestran el texto de carga si todavía no se cargó nunca (`loading && nunca cargado`); en cualquier navegación posterior se renderiza directamente la lista.
- Aplica a `_app.projects.index.tsx`, `_app.songs.index.tsx`, `_app.index.tsx` y `_app.live.tsx`.

### 4. Nada más cambia
- Sin dependencias nuevas, sin cambio de arquitectura, se respetan las capas UI → feature/service → repository → adaptador local. Navegación por teclado y foco quedan intactos (solo se mueve dónde vive el provider).

## Medición

Antes y después, con el navegador automatizado sobre `/`, `/projects`, `/songs`, `/bible`, `/media`, `/presets`, `/live`, `/outputs`, `/settings`:
- `performance.mark` al hacer clic y al aparecer el nuevo `<h1>`, para medir el inicio del cambio visual (objetivo < 50 ms).
- Conteo de peticiones de documento durante la navegación (debe ser 0).
- Conteo de lecturas de `localStorage` por navegación (debe ser 0 tras la primera carga).
- Comprobación de que el nodo del sidebar es el mismo elemento antes y después (no hay remontaje) y de que la ruta activa se marca de inmediato.
- Consola sin errores ni warnings.

## Pruebas de regresión

En `tests/`, con las convenciones actuales (`bun:test`):
- **Estructura de rutas:** verificar por análisis del código fuente que `_app.projects.tsx`, `_app.songs.tsx` y `_app.live.tsx` no montan `SongsProvider` y que `_app.tsx` sí lo hace (detecta el retroceso a providers por ruta).
- **Repositorio:** con un almacenamiento en memoria instrumentado, comprobar que una secuencia de operaciones no dispara lecturas repetidas innecesarias.
- **Estado de carga:** prueba pura de la regla "mostrar carga solo si nunca se cargó", extraída como función/derivación testeable.

Al final: `bun test` completo, typecheck y build.

## Archivos

**Modificados**
- `src/routes/_app.tsx` (monta `SongsProvider`)
- `src/routes/_app.projects.tsx`, `src/routes/_app.songs.tsx` (quitan el provider)
- `src/routes/_app.live.tsx` (quita el provider, mantiene `PresentationProvider`)
- `src/features/songs/songs-context.tsx`, `src/features/projects/projects-context.tsx` (exponer "ya cargado alguna vez")
- `src/routes/_app.projects.index.tsx`, `src/routes/_app.songs.index.tsx`, `src/routes/_app.index.tsx` (no tapar el contenido)
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (ADR: providers de datos viven en el App Shell), `docs/TESTING.md`

**Nuevos**
- `tests/routing/app-shell-providers.test.ts`
- `tests/features/loading-state.test.ts`

## Decisiones que necesitan tu aprobación

1. **Subir `SongsProvider` al App Shell** implica que las canciones se cargan también en secciones que no las usan (Bible, Media, Settings). Es una lectura local única y barata; la alternativa sería un caché compartido fuera de React, más complejo. Propuesta: subirlo al shell.
2. **`_app.projects.tsx` y `_app.songs.tsx`** quedan casi vacíos. Propuesta: conservarlos devolviendo `<Outlet />` para no tocar el árbol de rutas.
3. **Carga inicial**: se mantiene en efecto (compatible con SSR) en lugar de leer localStorage de forma síncrona, para evitar diferencias de hidratación. El coste es un único parpadeo en el primer arranque de la app.
