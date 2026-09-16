# Fase 0 — Arquitectura y Documentación

Solo documentación y estructura base. Sin funcionalidades de producto, sin Supabase, sin PWA, sin IndexedDB, sin Presentation Engine.

## 1. Documentos en el proyecto

Copiar los 9 documentos adjuntos a `/docs` dentro del proyecto (README del proyecto se mantiene aparte en la raíz), y actualizarlos donde hay contradicciones con el stack real.

## 2. Contradicciones detectadas y cómo se resuelven

1. **Estructura `src/app/` + `src/pages`** (README adjunto) vs. el stack real de este proyecto, que usa enrutado por archivos en `src/routes/`. Se adopta `src/routes/` y se actualiza README/ARCHITECTURE.
2. **"No usar Lovable Cloud como base principal si Supabase está configurado"**: hoy no hay ningún backend conectado. Se documenta que el backend se decide en la Fase 12, no antes.
3. **Rutas de outputs**: `/output/main` etc. encajan bien con enrutado por archivos; se documenta la convención de nombres de archivo correspondiente.
4. **Estado global**: los documentos mencionan Zustand "o equivalente". Se documenta la decisión (nueva ADR) de no añadir librería de estado hasta la Fase 4, cuando el Presentation Engine la necesite realmente. Evita sobreingeniería.
5. **Design system**: los tokens propuestos (`surface`, `live`, `offline`, etc.) deben definirse como tokens semánticos en la hoja de estilos global del proyecto, no como colores sueltos. Se documenta el mapeo; la implementación es Fase 1.
6. **Testing**: los documentos describen Vitest/Playwright, que aún no están instalados. Se documenta como tarea de Fase 4 (primeros tests del motor), no de Fase 0.

## 3. Estructura propuesta

```text
docs/                     documentos fuente de verdad
src/
├── routes/               rutas (app, /output/*, /remote)
├── components/ui/        componentes base reutilizables
├── components/layout/    shell: sidebar, topbar
├── features/             projects, songs, bible, media, presets,
│                         presentation, outputs, remote
├── domain/               tipos y reglas de negocio puras
├── services/             repositorios y acceso a datos (futuro)
├── stores/               estado (a partir de Fase 4)
├── lib/                  utilidades
└── styles.css            tokens del design system
```

Regla de dependencias: `routes → features → domain`. Nunca al revés, y nunca acceso directo a persistencia desde componentes.

En Fase 0 solo se crean las carpetas que ya tienen contenido real; el resto se documenta y se crea cuando su fase llegue.

## 4. Cambios concretos en esta fase

- Crear `/docs` con los 9 documentos.
- Actualizar `ARCHITECTURE.md`: estructura real de carpetas, regla de dependencias, convención de rutas de outputs.
- Actualizar `README.md` (docs): estructura corregida y comandos reales del proyecto.
- Actualizar `DECISIONS.md`: nuevas ADR-007 (enrutado por archivos), ADR-008 (estado global diferido a Fase 4), ADR-009 (tokens semánticos como única fuente de color).
- Actualizar `ROADMAP.md`: Fase 0 marcada como completada, criterios de aceptación tildados.
- Crear `roadmap.md` en la raíz como lista de tareas viva del desarrollo.
- Dejar la página inicial del proyecto con una pantalla mínima que indique el estado del proyecto (aún no es la app; el shell real llega en Fase 1) con metadatos propios de título y descripción.

## 5. Viabilidad técnica (verificada contra el stack)

- **Local-first**: viable. El acceso a datos se aísla tras una capa de repositorios, de modo que IndexedDB (Fase 11) entra sin tocar la UI.
- **PWA**: viable, pero el proyecto renderiza en servidor; el service worker debe registrarse solo en cliente y no cachear respuestas HTML de forma agresiva. Se documenta en OFFLINE_STRATEGY.
- **Outputs**: viables como rutas independientes. La sincronización entre ventanas usará BroadcastChannel local (no la nube), decisión a confirmar en Fase 6.

## 6. Riesgos técnicos a registrar

- Sincronización entre ventanas de output: BroadcastChannel no funciona entre dispositivos distintos; el Remote (Fase 15) necesitará otro canal.
- Reproducción de video a pantalla completa sin cortes depende del navegador; validar temprano en Fase 6.
- El renderizado en servidor obliga a cuidar el código que solo funciona en el navegador (almacenamiento local, ventanas); se documenta como regla.

No se avanza a la Fase 1 sin tu aprobación.
