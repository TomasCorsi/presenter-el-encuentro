# Fase 8.2 — Rediseño del espacio de trabajo Live

Rediseño exclusivamente de interfaz y distribución de `/live`. No cambia el Presentation Engine, Output Sync, Presets, Songs, Projects ni la semántica Preview/Program/TAKE (auto-advance ya implementado en Fase 8.1 se mantiene tal cual).

## 1. Nueva organización de la pantalla

Tres columnas con scroll independiente y barra de controles fija abajo, todo dentro del alto de la ventana (sin scroll global):

```text
┌───────────── barra de show: proyecto · avisos · recargar · abrir salida ─────────────┐
├──────────────┬────────────────────────────────────────────┬──────────────────────────┤
│ RUNDOWN      │ SLIDES DEL ELEMENTO SELECCIONADO           │ PROGRAM   16:9           │
│ 01 Canción A │ [01 Verso 1] [02 Coro]  [03 Verso 2]       │ estado CONTENT/CLEAR/    │
│ 02 Canción B │ [04 Puente ] [05 Coro]                     │ BLACK + acento al aire   │
│ 03 Aviso     │                                            ├──────────────────────────┤
│ (scroll)     │ (scroll, zona con más espacio)             │ PREVIEW   16:9           │
├──────────────┴────────────────────────────────────────────┴──────────────────────────┤
│ Previous (←)   Next (→)   TAKE (Enter)   Clear   Black                               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Dimensionado: rundown de ancho fijo (`260px`, `220px` por debajo de 1440px), columna derecha fija (`340px`, `300px` en pantallas menores), y la rejilla de slides ocupa todo el resto. En anchos menores a `lg` las zonas se apilan: Program, Preview, slides, rundown, controles. Densidad compacta: separadores de 1px, padding reducido, sin tarjetas grandes ni huecos decorativos.

## 2. Comportamiento

- Rundown: solo lectura, con número, título, tipo/conteo, marca de «sin contenido», elemento seleccionado y elemento al aire.
- Slides: rejilla auto-ajustable (`repeat(auto-fill, minmax(190px, 1fr))`) para que un juego típico de canción se vea entero. Cada miniatura muestra número, etiqueta, extracto legible y sus marcas de estado. Un clic selecciona Preview; nunca envía al aire.
- Program arriba a la derecha con acento «live»; Preview debajo, con acento azul (`primary`), más compacto.
- Elemento vacío o con contenido faltante: mensaje compacto en la zona central, TAKE deshabilitado, Program sin cambios.
- Controles abajo, siempre visibles, con atajos indicados y foco visible. Sin Logo.
- Auto-advance: sin cambios de lógica; los botones y las flechas siguen llamando a los mismos comandos del store, de modo que dentro del mismo elemento arrastran Program y al cruzar de elemento solo mueven Preview.

## 3. Detalles técnicos

Reutilizados sin cambios de contrato: `PresentationProvider`, store, selectores, `presentation-live.ts`, `buildLiveSnapshot`, `useLiveKeyboard`, `useOutputPublisher`, `SlideRenderer`, `LiveShowBar`.

Modificados (solo presentación):
- `src/routes/_app.live.tsx` — nueva rejilla de tres columnas a alto completo, barra de controles fija, paso de props a los paneles; sin cambios de lógica de carga, desfase ni handlers.
- `src/features/live/components/live-rundown.tsx` — filas más densas, indicador de posición, estado al aire más sobrio.
- `src/features/live/components/live-slide-grid.tsx` — rejilla auto-ajustable, miniaturas mayores, estados Preview/Program explícitos (anillo `primary` para Preview, barra y anillo `live` para Program, ambos combinables) y etiqueta accesible por miniatura.
- `src/features/live/components/live-monitors.tsx` — pasa de dos columnas a apilado vertical (Program arriba, Preview abajo) mediante una prop de orientación; conserva badges y semántica de modos.
- `src/features/live/components/slide-surface.tsx` — acento por tono: `primary` para Preview, `live` para Program al aire.
- `src/features/live/components/live-controls.tsx` — barra densa con atajos visibles; TAKE destacado.
- `src/components/layout/page.tsx` — sin cambios; Live seguirá usando `Page` con clases de alto completo.

Nuevo: ninguno obligatorio. Solo si el archivo de ruta crece demasiado, se extrae `src/features/live/components/live-workspace.tsx` con el armado de las tres zonas, sin lógica propia.

Tokens: se usan únicamente tokens semánticos existentes (`border`, `card`, `muted`, `primary`, `live`, `stage`). Si hace falta una altura de barra de controles o un ancho de rundown reutilizable, se añaden como variables en `src/styles.css` y se documentan en `DESIGN_SYSTEM.md` como reglas de densidad broadcast.

Sin dependencias nuevas.

## 4. Pruebas y verificación

Las pruebas actuales de dominio y store no cambian (la lógica no se toca) y deben seguir pasando: 166 tests. Se añade un test de interfaz ligero para el rundown y la rejilla (elemento seleccionado marcado, slide en Preview marcada, slide en Program marcada, clic en slide selecciona Preview y no cambia Program) usando el entorno de pruebas ya configurado.

Verificación en navegador con datos de ejemplo: rundown visible, selección de elemento, rejilla de slides, marcas de Preview y Program simultáneas, TAKE, auto-advance dentro del elemento, límite de elemento exige TAKE, Clear, Black, contenido faltante, teclado, 1920×1080 y 1366×768, consola limpia. Más `bun test`, typecheck y build.

Documentación: `ROADMAP.md` (Fase 8.2), `TESTING.md` (checklist de layout) y `DESIGN_SYSTEM.md` solo si se añaden reglas de densidad.

## 5. Riesgos de regresión

- Alto completo sin scroll global: si el App Shell impone padding o alto automático, la barra inferior podría quedar fuera de vista en 1366×768. Se comprueba en ambas resoluciones.
- Cambiar la orientación de los monitores podría alterar el tamaño de las superficies 16:9; el renderer compartido usa unidades de contenedor, así que se verifica que Preview, Program y `/output/main` sigan viéndose iguales.
- Reordenar el DOM afecta el orden de tabulación; se revisa que el teclado y el foco visible sigan funcionando.
- Riesgo bajo en lógica: no se tocan engine, store, snapshot ni protocolo de salida.
