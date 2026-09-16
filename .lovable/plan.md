# Fase 1.1 — Refinamiento visual del App Shell

## Objetivo

Refinar la presentación visual del App Shell existente para que se perciba como una superficie de control broadcast: precisa, sobria, legible a distancia y orientada a operación en vivo.

Se mantendrán intactos la arquitectura, el routing, el comportamiento, las rutas, los estados mock y el alcance funcional de la Fase 1. No se añadirán dependencias ni funcionalidades de producto.

## Dirección visual aprobada

Se seguirá la dirección **Broadcast control surface**, tomando de la referencia:

- zonas operativas claramente delimitadas mediante superficies y divisores sutiles;
- jerarquía tipográfica más firme y legible en monitores 1080p;
- selección azul clara y contenida;
- controles compactos con presencia física, sin efectos ornamentales;
- información técnica secundaria en tipografía monoespaciada.

La referencia se adaptará al proyecto: no se usarán fuentes externas, colores literales, datos técnicos ficticios, estados LIVE simulados, gradientes decorativos, glow ni una barra inferior nueva.

## Cambios visuales

### App Shell y escala

- Ajustar los tokens existentes para diferenciar mejor fondo, sidebar, superficies, superficies elevadas, bordes y selección sin convertir cada sección en una tarjeta.
- Aumentar selectivamente la legibilidad de títulos, navegación y textos operativos; conservar etiquetas técnicas y metadata en una escala compacta.
- Mantener radios pequeños, bordes nítidos, transiciones breves y foco visible.
- Conservar el scroll propio del contenido y los modos `contained` / `full` por página.

### Sidebar

- Mantener ancho, estructura, rutas y colapso actuales.
- Reforzar el item activo con fondo de selección, borde/inset sutil e icono azul; mejorar hover y foco sin usar colores de estado.
- Sustituir la sensación de categorías administrativas por grupos más discretos: etiquetas menos dominantes, separación basada en ritmo y divisores sutiles.
- Ajustar altura de items, tamaño de iconos y padding para lectura cómoda a distancia sin perder densidad.
- Integrar mejor cabecera de workspace y footer de usuario/conexión; mantener exactamente los datos mock actuales.
- Preservar tooltips y lectura correcta en modo colapsado.

### Topbar

- Convertirla en una banda de contexto compacta, con altura estable y mejor reparto horizontal.
- Agrupar visualmente `Workspace / Proyecto activo` con separadores discretos y jerarquía clara.
- Integrar conexión y usuario en un bloque derecho coherente, sin agregar telemetría, reloj ni datos inventados.
- Mantener el disparador de sidebar, el perfil mock y el comportamiento responsive actuales.

### Home — Production Center

- Eliminar la cuadrícula uniforme de ocho enlaces.
- Crear una composición de tres niveles, sin lógica nueva:
  1. **Acciones principales:** Projects y Live, con mayor escala y presencia visual.
  2. **Contexto actual:** un bloque compacto que muestre únicamente `Sin proyecto activo` y el estado de conexión ya existentes.
  3. **Herramientas de producción:** Songs, Bible, Media, Presets y Outputs en accesos secundarios más densos.
- Settings quedará como acceso terciario y discreto, no al mismo nivel que las herramientas de producción.
- Todos los accesos seguirán siendo `Link` del router y conservarán las rutas actuales.

### Empty States

- Rehacer `EmptyState` como bloque compacto, de altura intrínseca, alineado naturalmente bajo el encabezado y sin gran caja punteada.
- Usar un icono sencillo, título y descripción con ancho de lectura controlado; evitar centrar artificialmente contenido en todo el viewport.
- Projects seguirá comunicando únicamente que todavía no hay proyectos.
- Live tendrá una presencia algo más firme mediante jerarquía y superficie, pero seguirá siendo un placeholder; no mostrará rundown, preview, program, controles ni estados LIVE.
- El mismo patrón compacto se aplicará de forma consistente a Songs, Bible, Media, Presets, Outputs y Settings sin cambiar su alcance.

## Componentes y archivos

### Componentes existentes a modificar

- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/app-topbar.tsx`
- `src/components/layout/page.tsx`
- `src/components/ui/status-badge.tsx`
- `src/components/ui/empty-state.tsx`
- `src/routes/_app.index.tsx`
- `src/routes/_app.projects.tsx`
- `src/routes/_app.live.tsx`
- `src/styles.css`

Las demás rutas vacías se revisarán visualmente a través del componente compartido; solo se modificarán individualmente si necesitan una clase o texto de presentación para mantener consistencia, sin alterar metadatos ni comportamiento.

### Componente nuevo

Crear un único componente presentacional reutilizable para los accesos de Home, con variantes `primary`, `secondary` y `tertiary`. Su propósito será evitar duplicación, mantener iconografía, foco y estados hover consistentes, y conservar `_app.index.tsx` legible. No tendrá estado, datos ni lógica de producto.

Archivo previsto:

- `src/components/ui/production-shortcut.tsx`

### Documentación

- `docs/DESIGN_SYSTEM.md`: registrar las reglas reutilizables de jerarquía, superficies, densidad, selección y estados vacíos.
- `docs/ROADMAP.md`: añadir **Fase 1.1 — Refinamiento visual** y marcarla completada solo después de todas las verificaciones.
- No se crearán documentos nuevos.

## Verificación

- Revisar Home, Projects, Live y el resto de rutas en 1920×1080 y 1366×768.
- Verificar sidebar expandida y colapsada, navegación por router y adaptación responsive existente.
- Recorrer navegación y controles con teclado; comprobar foco visible y nombres accesibles.
- Confirmar que Projects y Live siguen siendo placeholders sin interfaces futuras.
- Confirmar ausencia de errores importantes en consola.
- Buscar colores literales en componentes; todos los colores deberán provenir de tokens semánticos.
- Confirmar que `package.json` y el lockfile no cambian.

## Límites confirmados

- Sin cambios de arquitectura, routing o comportamiento.
- Sin nuevas rutas ni navegación.
- Sin dependencias nuevas ni fuentes externas.
- Sin persistencia, sincronización ni conexión cloud.
- Sin Projects, Songs, Bible, Media, Presets, Live, Outputs o Presentation Engine funcionales.
- Sin estadísticas, señales, telemetría o información ficticia adicional.
- No se avanzará a la Fase 2.
