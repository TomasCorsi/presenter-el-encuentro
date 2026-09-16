# PROMPT MAESTRO PARA LOVABLE

Quiero desarrollar una aplicación web profesional de presentación en vivo orientada principalmente a iglesias, eventos y transmisiones.

El concepto es similar en propósito a ProPresenter, EasyWorship y otros sistemas de presentación, pero NO quiero copiar sus interfaces ni su código.

Quiero crear un producto original, moderno, simple de aprender, rápido y preparado para crecer.

## Objetivos

El sistema debe ser:

- Web.
- Instalable como PWA.
- Desktop-first.
- Responsive.
- Utilizable desde PC, tablet y celular.
- Offline-first para las funciones críticas.
- Rápido.
- Fluido.
- Modular.
- Escalable.
- Fácil de mantener.
- Seguro.

## Regla principal

NO intentes desarrollar todo el sistema de una vez.

El proyecto debe construirse por fases.

Cada fase debe:

1. Tener un objetivo concreto.
2. Tener alcance limitado.
3. Definir criterios de aceptación.
4. Implementarse completamente.
5. Verificarse.
6. Corregir errores.
7. Recién entonces quedar preparada para pasar a la siguiente fase.

NO comenzar automáticamente la siguiente fase.

Cuando termines una fase:

- Resume qué se realizó.
- Indica qué archivos principales fueron creados/modificados.
- Explica cómo probarla.
- Indica decisiones técnicas importantes.
- Espera mi aprobación antes de continuar.

## Documentación obligatoria

Usa la carpeta:

```text
/docs
```

y toma como fuente de verdad los siguientes documentos:

```text
README.md
PRODUCT.md
ARCHITECTURE.md
ROADMAP.md
DATA_MODEL.md
DESIGN_SYSTEM.md
OFFLINE_STRATEGY.md
DECISIONS.md
TESTING.md
```

Mantén estos documentos actualizados.

## Stack

Usar el stack moderno soportado actualmente por Lovable.

Preferencias:

- TypeScript.
- React / TanStack Start según el proyecto.
- Tailwind CSS.
- Zustand o una solución ligera equivalente.
- IndexedDB para persistencia local.
- Service Worker para PWA.
- Supabase para Auth, PostgreSQL, Storage y sincronización.
- Realtime solo cuando sea necesario.

No usar Lovable Cloud como base principal si Supabase está configurado.

## Buenas prácticas

- TypeScript estricto.
- Evitar `any`.
- Componentes pequeños.
- Bajo acoplamiento.
- Alta cohesión.
- Separación de responsabilidades.
- Manejo de loading, empty, offline y error.
- No duplicar lógica.
- No agregar dependencias innecesarias.
- No hacer refactors grandes sin documentarlos.

## Performance

La aplicación será utilizada EN VIVO.

Priorizar:

- Cambios de slide instantáneos.
- Sin recargas innecesarias.
- Precarga del contenido próximo.
- Lazy loading.
- Code splitting.
- Optimización de imágenes.
- Virtualización cuando corresponda.
- Evitar renders innecesarios.

No permitir que uploads, backups, thumbnails o sync bloqueen Live.

## UX

El software será operado por voluntarios.

Principios:

- Menos clicks.
- Acciones críticas visibles.
- Feedback inmediato.
- Jerarquía clara.
- Atajos de teclado.
- Drag & drop cuando sea útil.
- Confirmar solo acciones destructivas.
- Preview y Program nunca deben confundirse.
- Live debe ser extremadamente visible.

## Diseño visual

- Dark UI.
- Profesional.
- Minimalista.
- Alta legibilidad.
- Alto contraste.
- Bordes sutiles.
- Espaciado consistente.
- Tipografía limpia.
- Controles grandes.
- Animaciones breves y funcionales.

Evitar:

- Gradientes excesivos.
- Glassmorphism exagerado.
- Decoración sin función.

## Arquitectura

Separar:

```text
UI
Domain
State
Services
Persistence
Sync
Presentation Engine
Outputs
```

No acoplar IndexedDB ni Supabase directamente a componentes.

## Funciones futuras

El sistema eventualmente tendrá:

- Workspaces.
- Projects.
- Songs.
- Bible.
- Media.
- Presets.
- Live.
- Main Output.
- Stage Output.
- Stream Output.
- PWA.
- Offline.
- Cloud Sync.
- Backup/Restore.
- Mobile Remote.

## Presentation Engine

Crear más adelante un estado central desacoplado con conceptos como:

```text
currentItem
currentSlide
nextSlide
previousSlide
isLive
isBlack
isClear
showLogo
activePreset
activeOutputs
```

## Outputs

Preparar arquitectura para:

```text
/output/main
/output/stage
/output/stream
```

No implementar inicialmente:

- NDI.
- DeckLink.
- SDI.
- Spout.
- Electron.
- Tauri.
- Rust.

## Offline-first

Las funciones críticas deben funcionar sin Internet.

Durante una presentación offline deben funcionar:

```text
Projects
Songs
Bible descargada
Presets
Media descargada
Slides
Next
Previous
Clear
Black
Logo
Main Output
Stage Output
```

## Seguridad

Nunca:

- Exponer service role keys.
- Hardcodear credenciales.
- Guardar secretos en frontend.

Usar:

- Variables de entorno.
- Supabase RLS.
- Validación.
- Políticas por workspace.

## Compatibilidad

Prioridad:

```text
Chrome
Edge
Safari
```

Desktop primero.

Resoluciones:

```text
1366x768
1920x1080
1440p
4K
```

## Definition of Done

Una fase está terminada solo si:

- Compila.
- No tiene errores importantes en consola.
- Funciona visualmente.
- Tiene estados apropiados.
- No rompió fases anteriores.
- La documentación está actualizada.
- Cumple criterios de aceptación.

# PRIMERA TAREA

Trabajar ÚNICAMENTE en:

## FASE 0 — ARQUITECTURA Y DOCUMENTACIÓN

Quiero que:

1. Analices todos los documentos Markdown.
2. Verifiques consistencia entre ellos.
3. Propongas la estructura del proyecto.
4. Ajustes la arquitectura si es necesario.
5. Dejes preparado el roadmap.
6. No implementes todavía funcionalidades avanzadas.

NO implementar aún:

- Supabase.
- PWA.
- IndexedDB real.
- Presentation Engine.
- Songs.
- Bible.
- Media.
- Outputs.
- Sync.

Al terminar:

1. Muéstrame un resumen.
2. Enumera los documentos revisados.
3. Indica las decisiones arquitectónicas.
4. Muestra el estado de la Fase 0.
5. Espera mi aprobación antes de comenzar la Fase 1.
