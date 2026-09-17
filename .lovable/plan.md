# Fase 8 — Presets

Contenido y apariencia quedan separados: la Song guarda texto, el Preset guarda cómo se ve, y un único renderer compartido dibuja la combinación en Preview, Program, Output y el editor.

## 1. Modelo de Preset

`src/domain/presets/preset.ts`:

```ts
type PresetFontFamily = "sans" | "serif" | "mono";   // stacks locales, sin CDN
type HorizontalAlign = "left" | "center" | "right";
type VerticalAlign = "top" | "center" | "bottom";

interface PresetStyle {
  fontFamily: PresetFontFamily;
  fontSize: number;      // % de la ALTURA del lienzo (1..30), ver §"Tamaño"
  fontWeight: 400 | 600 | 700;
  lineHeight: number;    // multiplicador 1.0..2.0
  align: HorizontalAlign;
  verticalAlign: VerticalAlign;
  textColor: string;     // hex, dato del usuario
  backgroundColor: string; // hex, dato del usuario
  safeAreaX: number;     // % del ancho  (0..20)
  safeAreaY: number;     // % de la altura (0..20)
}

interface Preset {
  id: string; workspaceId: string; name: string;
  style: PresetStyle;
  createdAt: string; updatedAt: string;
}
```

Sin propiedades anticipadas (nada de imagen, vídeo, overlays, transiciones).

**Tamaño de texto (opción D).** `fontSize` es un número relativo a la altura del lienzo. El renderer envuelve la slide en un contenedor 16:9 con `container-type: size` y expresa tipografía y safe area en unidades de contenedor (`cqh` / `cqw`). Así el Preview pequeño de Live, el Program y `/output/main` a 1920×1080 se ven proporcionalmente idénticos, y un cambio de resolución no rompe nada. Sin píxeles fijos en ningún caso.

**Colores.** Los colores del Preset son datos del usuario y se aplican por `style` inline dentro del renderer. Los componentes de la aplicación (paneles, listas, botones) siguen usando exclusivamente tokens semánticos.

## 2. Default Preset

Constante de dominio `DEFAULT_PRESET` con id reservado `preset-default`: texto blanco, fondo oscuro sobrio, centrado horizontal y vertical, safe area 8%/8%. No se persiste; el servicio la antepone siempre a la lista. No se puede eliminar ni editar (se duplica para partir de ella). Resultado: el sistema nunca queda sin estilo válido, ni siquiera con el almacenamiento vacío o corrupto.

## 3. Asignación y resolución

`RundownItem` gana `presetId?: string` (opcional, migración no destructiva: ausente = default). Es el nivel correcto porque la misma Song puede aparecer dos veces con estilos distintos sin tocar la Song.

Resolución pura `resolvePreset(presetId, presets) → Preset`: si no hay id, o el id ya no existe, devuelve el Default. `projectToPresentation` propaga `presetId` al `PresentationItem`; el estilo del Program se resuelve por su item.

En `/projects/$projectId` cada fila del rundown gana un selector compacto de Preset (acción secundaria), sin convertir el rundown en formulario.

## 4. Renderer compartido

`src/features/presentation/components/slide-renderer.tsx`: componente puro que recibe `{ lines, style }` y no conoce ni el App Shell ni ningún provider. Lo consumen Live Preview, Live Program, `/output/main` y la vista previa del editor de Presets. Ninguna de esas superficies define tipografía o fondo por su cuenta.

## 5. Output Snapshot

`OutputSnapshot` pasa a llevar el estilo **resuelto**:

```ts
snapshot.slide = { id, lines, style: PresetStyle } | null
```

Output nunca lee repositories ni conoce `presetId`. `snapshotsEqual` compara además el estilo completo, así que cambiar solo el Preset (misma slide, mismo texto) produce un `update` inmediato.

## 6. CLEAR / BLACK

Sin cambios de semántica: `black` → negro puro (`--output-safe`), ignora el Preset. `clear` → fondo base opaco (`--output-base`), ignora el Preset. Sin sesión Live → negro puro. El Preset solo pinta en `content` con slide.

## 7. Biblioteca y editor

- `/presets`: tabla compacta con búsqueda, crear, abrir, renombrar, duplicar, eliminar. El Default aparece marcado, sin eliminar ni renombrar.
- `/presets/$presetId`: panel de configuración a la izquierda, vista previa 16:9 en vivo a la derecha, con texto de ejemplo propio ("Esta es una vista previa del texto" + varias líneas), nunca letras reales.
- Autoguardado con el mismo patrón que Songs: borrador local, debounce, indicador Guardando… / Guardado / Error al guardar.

## 8. Eliminar un Preset en uso

Se calcula el uso (items del rundown por project) y se advierte antes de eliminar, nombrando cuántos items y qué projects. Al confirmar, el preset se borra y los items afectados caen al Default por la resolución tolerante; no se reescriben los Projects. Motivo: evita una escritura masiva y mantiene una sola regla de fallback, la misma que cubre datos corruptos.

## Archivos

**Nuevos:** `src/domain/presets/preset.ts`, `preset-rules.ts`, `preset-resolution.ts`; `src/services/presets/preset-repository.ts`, `local-storage-preset-repository.ts` (`broadcast-control.presets.v1`); `src/features/presets/preset-service.ts`, `presets-context.tsx`, `components/preset-list.tsx`, `preset-row.tsx`, `preset-editor.tsx`, `preset-style-form.tsx`, `preset-picker.tsx`; `src/features/presentation/components/slide-renderer.tsx`; `src/routes/_app.presets.index.tsx`, `_app.presets.$presetId.tsx`.

**Modificados:** `src/routes/_app.presets.tsx` (layout con `Outlet`), `src/routes/_app.tsx` (montar `PresetsProvider` junto a los demás, ADR-031), `src/domain/projects/rundown.ts` y `rundown-rules.ts` (`presetId` opcional + comando para asignarlo), `project-to-presentation.ts` y `presentation.ts` (`presetId` en el item), `src/domain/output/output-snapshot.ts` y `output-publisher.ts` (estilo resuelto y comparación), `src/features/live/components/slide-surface.tsx` y `live-slide-grid.tsx`, `src/features/output/components/output-surface.tsx`, `src/features/projects/components/rundown-row.tsx`, `src/services/projects/local-storage-project-repository.ts` (aceptar `presetId`), `src/styles.css` (stacks de fuente), docs.

## Tests (`bun test`, sin dependencias nuevas)

Crear/editar/validar nombre, duplicar (`— copia`, id y fechas nuevas), default presente, default no eliminable, eliminar preset en uso, fallback a Default con id inexistente, persistencia y datos inválidos, resolución RundownItem → Preset, alineaciones y background del renderer (prueba pura del cálculo de estilo), OutputSnapshot con estilo resuelto, y el caso crítico: **misma slide y mismo texto con Preset distinto → produce `update`**.

## ADR propuestas

- ADR-032 Preset separado del contenido.
- ADR-033 Default Preset con id reservado, no persistido ni editable.
- ADR-034 Preset asignado por RundownItem, con resolución tolerante.
- ADR-035 Renderer de slide compartido por Preview, Program, Output y editor.
- ADR-036 Estilo resuelto dentro de OutputSnapshot.
- ADR-037 Tamaño tipográfico relativo al lienzo mediante unidades de contenedor.

Documentación actualizada: ROADMAP, DATA_MODEL, ARCHITECTURE, DECISIONS, TESTING.

## Fuera de alcance

Backgrounds de imagen/vídeo/gradiente, Media, Bible, transiciones, lower thirds, Stage, Stream, Remote, fuentes externas o subidas, Supabase, IndexedDB, cloud sync, logo, temas complejos.

## Decisiones que necesitan tu aprobación

1. **Default Preset no editable** (solo duplicable). Es la opción más robusta: nunca hay que reparar un default roto. Alternativa: hacerlo editable y persistir un override.
2. **Eliminar preset en uso no reescribe los Projects**; los items caen al Default por resolución. Alternativa: limpiar las referencias al borrar (más escrituras, misma apariencia final).
3. **`fontSize` como % de la altura del lienzo** con unidades de contenedor, en lugar de px o vh. Garantiza que Preview y Output se vean iguales.
4. **Fuentes limitadas a tres stacks del sistema** (sans, serif, mono), sin selector libre.
5. **`presetId` vive en el RundownItem**, no en la Song ni en el Project. Un preset global de Project se podría añadir después como nivel intermedio de la jerarquía.
