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

## Refinamiento del App Shell (Fase 1.1)

### Superficies

- El fondo, la barra lateral, las superficies de contenido y las superficies
  elevadas deben distinguirse mediante tokens y bordes sutiles, no mediante
  sombras fuertes ni gradientes decorativos.
- Las secciones de página no se presentan como tarjetas flotantes. Las tarjetas
  se reservan para accesos individuales y bloques de información concretos.
- Los radios son pequeños y los divisores son nítidos para conservar el carácter
  de una superficie de control profesional.

### Jerarquía y densidad

- Los títulos de página deben poder leerse con comodidad en un monitor 1080p;
  las etiquetas de sección y los datos técnicos permanecen compactos.
- La tipografía monoespaciada se limita a estados y metadata técnica.
- La navegación mantiene objetivos de interacción estables y espaciado denso,
  sin sacrificar foco visible ni lectura a distancia.

### Selección y estados

- El azul identifica selección, foco y navegación activa.
- `live`, `success`, `warning` y `offline` se usan únicamente cuando comunican
  estados reales o mocks explícitos del sistema, nunca como decoración.
- El estado activo de navegación combina superficie, borde e icono para no
  depender exclusivamente del color.

### Estados vacíos

- Tienen altura intrínseca y se integran bajo la cabecera de página.
- Evitan cajas punteadas de gran tamaño y no llenan artificialmente el viewport.
- Incluyen únicamente icono, título, explicación breve y acciones reales cuando
  existan.
