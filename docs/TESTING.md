# Testing Strategy

## Objetivo

Mantener confiables las funciones críticas sin sobreingeniería.

## Prioridades

### Nivel 1 — Presentation Engine

Probar:

- Next.
- Previous.
- Ir a slide específico.
- Clear.
- Black.
- Logo.
- Cambio de item.
- Límites de navegación.

### Nivel 2 — Projects

Probar:

- Orden.
- Drag & drop.
- Agregar.
- Eliminar.
- Duplicar.
- Persistencia.

### Nivel 3 — Presets

Probar:

- Aplicación de preset.
- Defaults.
- Overrides.
- Layout por output.

### Nivel 4 — Offline

Probar:

- Lectura local.
- Escritura local.
- Reconexión.
- Cola de cambios.
- No bloquear Live.

### Nivel 5 — Sync

Probar:

- Local → Cloud.
- Cloud → Local.
- Retry.
- Error.
- Conflictos.

## E2E críticos

### Presentación básica

1. Abrir proyecto.
2. Iniciar Live.
3. Cambiar slides.
4. Clear.
5. Black.
6. Logo.
7. Verificar Main Output.

### Sin Internet

1. Abrir proyecto preparado.
2. Desconectar red.
3. Operar durante varios minutos.
4. Reconectar.
5. Validar sincronización.

## Definition of Done

Una fase no está completa si:

- No compila.
- Tiene errores críticos de consola.
- Rompe funciones anteriores.
- No cumple criterios de aceptación.
- No actualiza documentación.

---

## Tooling Recomendado (Fase 4+)

- **Unit/Logic**: `Vitest` (Fast, Vite-native).
- **Components**: `Vitest` + `@testing-library/react`.
- **E2E**: `Playwright`.

## Estrategia de Minimización

1. **Lógica Pura**: Extraer reglas de negocio a funciones puras testeables sin DOM.
2. **Lazy Tooling**: No añadir runners hasta la Fase 4.
3. **Mocking**: Usar `msw` solo cuando la complejidad de red lo requiera.

## Fase 2 — Projects

La lógica pura y el repository temporal se prueban con `bun test`, disponible
sin instalar dependencias. Cubre validación, creación, renombrado, duplicación,
eliminación del proyecto activo, orden, búsqueda, persistencia y recuperación
ante datos locales inválidos.

Vitest, Testing Library y Playwright como dependencias del proyecto continúan
diferidos hasta que su alcance lo requiera. Las comprobaciones E2E de esta fase
usan únicamente el entorno de desarrollo.

## Fase 3 — Songs

`bun test` cubre el dominio (validación de título, labels automáticos no
destructivos, operaciones de secciones, duplicación con IDs nuevos, búsqueda)
y el repository temporal (CRUD, JSON inválido, formas corruptas, copias sin
referencias compartidas y propagación de errores de cuota). El autoguardado
(debounce, blur, flush) se verifica con comprobaciones E2E en el entorno de
desarrollo.

## Nota de Fase 0

Aún no hay runner de tests instalado. Vitest y Playwright se añaden en la
Fase 4, junto con los primeros tests del Presentation Engine. No se instalan
dependencias antes de que su fase las requiera.

## Fase 4 — Presentation Engine

`bun test` cubre el motor sin DOM ni navegador:

- **Runtime**: índices por item y slide, orden global navegable, items vacíos
  presentes en el índice pero fuera del recorrido, normalización de orden e
  ids duplicados descartados.
- **Presentación vacía**: load vacío, comandos no-op, selección inexistente.
- **Navegación**: dentro del item, entre items en ambos sentidos, extremos sin
  wrap, items sin slides saltados, selectores next/previous en bordes.
- **Items sin slides**: selección con slide `null`, `next`/`previous` buscando
  la slide más cercana en esa dirección y no-op cuando no existe.
- **Reemplazo y reset**: preservación de posición, caídas a item o primera
  slide, estado vacío, IDs inválidos.
- **Song → PresentationItem**: determinismo con el mismo `itemId`, ausencia de
  colisiones con `itemId` distinto, orden de secciones, secciones vacías
  omitidas y canción sin secciones.
- **Store**: notificación, `unsubscribe` e identidad de estado estable sin
  notificar cuando un comando no cambia nada.

## Fase 5 — Project Rundown / Composition

`bun test` cubre la composición sin DOM:

- **Rundown**: agregar al final, repetir la misma canción con ids de instancia
  distintos, mover con no-op en los extremos, eliminar solo esa instancia,
  normalización de `order` a 0..n-1 y duplicación con identidades nuevas.
- **Uso de una Song**: `findSongUsage` como regla pura sobre los projects.
- **Migración v1 → v2**: `rundown: []` por defecto, `itemIds` descartado, clave
  v1 conservada como respaldo, v2 leída sin volver a migrar, rundown inválido
  reparado, items inválidos descartados conservando los válidos, datos
  corruptos → estado vacío y persistencia de un rundown completo.
- **Rundown → PresentationItems**: orden, `itemId` de instancia, `sourceId` de
  origen, canción repetida sin colisiones de ids de slide, referencia rota como
  item sin slides y rundown vacío.

## Fase 6 — Live Mode

`bun test` cubre la operación sin DOM:

- **Program**: TAKE con y sin slide de Preview, TAKE fijando `content`, Preview
  que se mueve sin arrastrar Program, y marcas de slide/item al aire.
- **Modos de salida**: `clear` y `black` conservando `programSlideId`, vuelta a
  `content` recuperando la misma slide, toggle y no-op al repetir modo.
- **Load / Reload**: `loadPresentation` descartando Program siempre;
  `reloadPresentation` conservando Preview y Program cuando los ids persisten y
  anulándolos cuando desaparecen.
- **Snapshot**: composición del show, referencias rotas como items sin slides y
  firma de origen que detecta cambios de rundown y de canción.
- **Store**: TAKE y modos de salida a través del store, sin notificar cuando un
  comando no cambia nada.

## Fase 7 — Output Sync

- **Dominio** (`tests/output/output-snapshot.test.ts`): serialización y
  validación de mensajes; `snapshotsEqual` detecta mismo `slide.id` con
  `lines` distintas (editar Song + recargar publica update).
- **Publisher** (`tests/output/output-publisher.test.ts`): publica solo ante
  cambios visibles; responde `hello` con snapshot completo; `bye` al cerrar.
- **Subscriber** (`tests/output/output-subscriber.test.ts`): adopción del
  primer snapshot, descarte de mensajes fuera de orden, vinculación de sesión
  (ignora Live B mientras A vive; adopta B tras `bye` de A), timeout sin
  `bye` → salida segura, reconexión, `bye` de otra sesión ignorado, mensajes
  inválidos ignorados, múltiples subscribers.
- **Navegador** (Playwright): TAKE reflejado en Output, Preview no afecta,
  Clear/Black/Content, dos Outputs simultáneos, recarga de Output, Live
  ausente → negro puro, overlay de fullscreen y cursor oculto, 1920×1080,
  consola sin errores.
