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

## Nota de Fase 0

Aún no hay runner de tests instalado. Vitest y Playwright se añaden en la
Fase 4, junto con los primeros tests del Presentation Engine. No se instalan
dependencias antes de que su fase las requiera.
