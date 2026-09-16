# Presentation Platform

Plataforma web profesional de presentación en vivo orientada a iglesias, eventos y transmisiones.

## Objetivo

Construir una alternativa moderna, simple y escalable a herramientas como ProPresenter, EasyWorship o Arena, sin copiar sus interfaces ni su código.

La aplicación será:

- Web.
- Instalable como PWA.
- Desktop-first.
- Responsive.
- Offline-first para las funciones críticas.
- Rápida, fluida y fácil de operar.
- Modular y escalable.
- Preparada para PC, tablet y celular.
- Preparada para múltiples outputs.

## Stack propuesto

- TypeScript
- React / TanStack Start según el stack actual de Lovable
- Tailwind CSS
- Zustand o store equivalente
- IndexedDB para persistencia local
- Service Worker para PWA y cache offline
- Supabase para Auth, PostgreSQL, Storage y sincronización cloud
- Realtime solo cuando sea necesario

## Estructura del proyecto

Definida en la Fase 0. El stack usa TanStack Start con enrutado por archivos:
no hay `src/app/` ni `src/pages/`.

```text
docs/
src/
├── routes/               enrutado por archivos (app, /output/*, /remote)
├── components/ui/
├── components/layout/
├── features/
│   ├── projects/
│   ├── songs/
│   ├── bible/
│   ├── media/
│   ├── presets/
│   ├── presentation/
│   ├── outputs/
│   └── remote/
├── domain/
├── hooks/
├── lib/
├── services/
├── stores/
└── styles.css
```

Las carpetas se crean cuando su fase comienza. Ver `ARCHITECTURE.md` para la
regla de dependencias y las restricciones de SSR.


## Principios

1. Live nunca debe depender de Internet.
2. Preview y Program deben estar claramente diferenciados.
3. La interfaz debe ser usable por voluntarios con poca capacitación.
4. Las funciones críticas deben responder de manera inmediata.
5. Cloud sirve para sincronización y backup, no para depender de él en vivo.
6. Las fases deben desarrollarse y validarse una por una.

## Comandos

Los comandos exactos dependen del scaffold generado por Lovable. Mantener esta sección actualizada durante el desarrollo.

Ejemplo:

```bash
npm install
npm run dev
npm run build
npm run test
```

## Documentación

- `PRODUCT.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `DATA_MODEL.md`
- `DESIGN_SYSTEM.md`
- `OFFLINE_STRATEGY.md`
- `DECISIONS.md`
- `TESTING.md`
- `LOVABLE_MASTER_PROMPT.md`
