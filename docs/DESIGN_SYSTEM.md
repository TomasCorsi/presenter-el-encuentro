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

## Densidad y Composición

### Listas

- Utilizar `Table` con celdas compactas (padding reducido).
- Información técnica en fuente `mono`.
- Acciones secundarias visibles al hover.

### Diálogos

- Ancho contenido (`max-w-md` o `max-w-lg`).
- Agrupación densa de campos.
- Evitar decoraciones innecesarias.

### Detalle

- Uso de paneles laterales (`Sheet`) o vistas divididas (`ResizablePanel`).
- Jerarquía clara: el contenido principal domina la vista.

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

| Modo        | Uso                                                     |
| ----------- | ------------------------------------------------------- |
| `contained` | Settings, formularios y textos largos                   |
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

## Espacio de trabajo broadcast (Fase 8.2)

Reglas de layout para pantallas de operación en directo (`/live`):

- **Alto de ventana, sin scroll global.** La página ocupa el alto disponible y
  cada zona (rundown, slides, monitores) tiene su propio scroll. La barra de
  controles queda siempre visible al pie.
- **Anchos objetivo, no rígidos.** Las columnas laterales usan `clamp` para
  comprimirse en pantallas menores sin romper la zona principal:
  rundown `clamp(170px, 15vw, 260px)`, monitores `clamp(230px, 22vw, 340px)`.
- **Prioridad visual:** slides > Program > rundown > Preview. Preview puede
  compactarse más que Program.
- **Rejilla de slides auto-ajustable** (`auto-fill` con mínimo de 170–200px)
  para que un juego típico de canción se vea completo sin scroll.
- **Estado nunca solo por color.** Preview (`primary`) y Program (`live`) se
  marcan además con etiqueta textual y `aria-label`; una misma slide puede
  mostrar los dos estados a la vez.
- **Densidad:** separadores de 1px, padding reducido, sin tarjetas grandes ni
  espacios decorativos.

## Consola de operación (Fase 9.1)

Amplía las reglas de la Fase 8.2 con la capa operativa:

- **Barra de operación fija arriba**, bajo la barra de show: transporte
  (Previous, Next, TAKE), salidas (Clear, Black) y Buscar. Nunca se desplaza
  ni depende del scroll de ninguna columna.
- **Library Dock al pie**, colapsable, con scroll propio y altura acotada para
  no robar espacio a las slides. Pestañas Songs | Bible | Media.
- **Acciones explícitas, nunca implícitas**: cada resultado ofrece "Rundown"
  (agregar) y "Al aire" (agregar y proyectar). Sin arrastrar ni doble clic.
- **Afordancia de proyección**: la rejilla de slides rotula "un clic envía al
  aire" y cada slide expone `aria-label` "Enviar al aire la slide…".
- **Un solo buscador**: el botón Buscar y la tecla `/` abren y enfocan el
  campo de la pestaña activa del dock; no hay un quick search paralelo.
- **Sin Project activo** el dock sigue buscando, pero las acciones quedan
  deshabilitadas con una explicación compacta de una línea.

## Consola Live (Fase 9.2)

Tres columnas: rundown `clamp(170px,14vw,240px)`, rejilla de slides flexible y
Program `clamp(320px,30vw,520px)`. No hay monitor de Preview: la selección se
distingue en la rejilla. Controles siempre arriba, Library Dock abajo. La acción
"Quitar del rundown" de cada línea aparece al pasar el cursor o al tabular.

## Media en Project Detail (Fase 10)

La biblioteca lateral usa pestañas Songs | Media. Las filas Media del rundown
muestran thumbnail cuando existe, nombre y tipo Image/Video; si falta la
metadata conservan la aparición como contenido faltante. Bible mantiene su
flujo de alta propio y convive en el mismo rundown con Song y Media.
