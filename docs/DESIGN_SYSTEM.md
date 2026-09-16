# Design System

## Dirección visual

Aplicación profesional de producción audiovisual.

Características:

- Tema oscuro.
- Alta legibilidad.
- Alto contraste.
- Interfaces densas pero ordenadas.
- Acciones críticas visibles.
- Animaciones breves y funcionales.

## Colores semánticos

Definir tokens, no valores repetidos hardcodeados.

Ejemplo conceptual:

```text
background
surface
surfaceElevated
border
textPrimary
textSecondary
accent
live
success
warning
danger
offline
```

## Live

El estado LIVE debe tener una representación visual única y consistente.

Ejemplo:

```text
● LIVE
```

Debe diferenciarse de:

```text
PREVIEW
```

## Tipografía

Usar una tipografía sans-serif altamente legible.

Jerarquía:

- Display.
- Heading.
- Section title.
- Body.
- Label.
- Caption.
- Mono/technical.

## Espaciado

Usar escala consistente.

Ejemplo:

```text
4
8
12
16
20
24
32
40
48
```

## Radius

Evitar exceso de redondeo.

Ejemplo:

```text
small
medium
large
```

## Componentes base

- Button.
- IconButton.
- Input.
- Select.
- Search.
- Dialog.
- Drawer.
- Tooltip.
- Tabs.
- Panel.
- Card.
- StatusBadge.
- EmptyState.
- ErrorState.
- Skeleton.
- SplitPane.
- ResizablePanel.

## Botones críticos

### NEXT

- Grande.
- Fácil de localizar.
- Debe admitir keyboard shortcut.

### PREVIOUS

- Grande.
- Debe estar separado visualmente de acciones destructivas.

### CLEAR

- Visible.
- No debe confundirse con BLACK.

### BLACK

- Estado persistente visible.

### LOGO

- Debe mostrar claramente si está activo.

## Accessibility

- Focus visible.
- Contraste adecuado.
- Elementos interactivos con labels.
- Navegación por teclado.
- Tamaños táctiles suficientes.

---

## Implementación de tokens (definida en Fase 0)

Los tokens semánticos se definen en `src/styles.css` y se consumen únicamente a
través de clases semánticas. Nunca colores literales en los componentes
(ADR-009).

Mapeo previsto:

| Token conceptual | Token de la hoja de estilos |
| ---------------- | --------------------------- |
| background       | `--background`              |
| surface          | `--card`                    |
| surfaceElevated  | `--popover`                 |
| border           | `--border`                  |
| textPrimary      | `--foreground`              |
| textSecondary    | `--muted-foreground`        |
| accent           | `--primary`                 |
| live             | `--live` (nuevo)            |
| success          | `--success` (nuevo)         |
| warning          | `--warning` (nuevo)         |
| danger           | `--destructive`             |
| offline          | `--offline` (nuevo)         |

Los tokens nuevos (`live`, `success`, `warning`, `offline`) se crearon en la
Fase 1 junto con el tema oscuro, cada uno con su variante `-foreground`.

## Tipografía (definida en Fase 1)

No se cargan fuentes externas (Google Fonts, CDN). El producto es offline-first
y su apariencia base no puede depender de Internet.

```text
sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
```

La familia monoespaciada se reserva para información técnica: estados, rutas,
atajos y tiempos. Empaquetar una fuente local se evaluará más adelante.

## Ancho de página (definido en Fase 1)

El App Shell no impone ancho máximo. Cada pantalla elige mediante `Page`:

| Modo        | Uso                                                    |
| ----------- | ------------------------------------------------------ |
| `contained` | Settings, formularios y textos largos                  |
| `full`      | Live, Projects, Media, Presets, Outputs y vistas densas |
