# Roadmap

## Fase 9.2 — Correcciones de Live, Bible Dock y Rundown (en curso)

- [ ] Bible Dock de Live usa la misma fuente de verdad que `/bible` (contexto, repositorio, parser)
- [ ] Selección de traducción: auto con una, última elegida con varias, fallback si se eliminó, estado vacío
- [ ] Parser de referencias: estado neutro con entrada incompleta, error solo con referencia completa inválida
- [ ] Refresco ligero de metadata de traducciones al volver a Live
- [ ] Quitar RundownItem desde `/projects/$projectId` (revisión + tests)
- [ ] Quitar RundownItem desde Live (persistencia + baja incremental del runtime)
- [ ] `detachedProgramSlide`: snapshot renderizable completo al quitar el item al aire
- [ ] `goLive` y `take` siempre vuelven a `content` y limpian el snapshot congelado
- [ ] Quitar el monitor Preview visual; Program más grande; Preview sigue como estado interno
- [ ] Tests (Bible dock, rundown, Live sin Preview) + verificación en navegador
- [ ] Documentación (ROADMAP, DECISIONS, TESTING, DESIGN_SYSTEM)

## Siguiente

- Fase 10 — Media (no empezar hasta indicación del usuario)
