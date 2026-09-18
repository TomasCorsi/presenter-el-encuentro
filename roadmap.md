# Roadmap

## Fase 9.2 — Correcciones de Live, Bible Dock y Rundown (completada)

- [x] Bible Dock de Live usa la misma fuente de verdad que `/bible` (contexto, repositorio, parser)
- [x] Selección de traducción: auto con una, última elegida con varias, fallback si se eliminó, estado vacío
- [x] Parser de referencias: estado neutro con entrada incompleta, error solo con referencia completa inválida
- [x] Refresco ligero de metadata de traducciones al volver a Live
- [x] Quitar RundownItem desde `/projects/$projectId` (revisión + tests)
- [x] Quitar RundownItem desde Live (persistencia + baja incremental del runtime)
- [x] `detachedProgramSlide`: snapshot renderizable completo al quitar el item al aire
- [x] `goLive` y `take` siempre vuelven a `content` y limpian el snapshot congelado
- [x] Quitar el monitor Preview visual; Program más grande; Preview sigue como estado interno
- [x] Tests (Bible dock, rundown, Live sin Preview) + verificación en navegador
- [x] Documentación (ROADMAP, DECISIONS, TESTING, DESIGN_SYSTEM)

## Fase 9.3 — Output sobre proyector (completada)

- [x] Servicio de gestión de ventanas (soporte, permiso, detección, fingerprint, matching conservador)
- [x] Declaraciones de tipos locales de la Window Management API
- [x] Preferencia local de pantalla de audiencia (localStorage)
- [x] Settings → Pantalla del proyector (detectar, identificar, probar, olvidar)
- [x] Abrir Output sobre el proyector (reutilizar, reposicionar, popup bloqueado, proyector ausente)
- [x] Estado real de la ventana de salida en Live (cierre manual, proyector desconectado)
- [x] `/output/main`: «Iniciar salida», tecla F, doble clic, fullscreen con `screen`
- [x] `/output/main?mode=test`: pantalla de prueba aislada
- [x] Tests unitarios + verificación en navegador
- [x] Documentación (DECISIONS, ARCHITECTURE, TESTING con checklist Windows, ROADMAP)

## Siguiente

- Fase 10 — Media (no empezar hasta indicación del usuario)
