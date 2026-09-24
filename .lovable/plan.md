# Fase 10 — Quality Gate final: Media en Program y video

Sin nuevas features. Solo se corrigen los huecos que impiden cumplir los 9 casos.

## Brechas detectadas en el código actual

1. **Quitar Media al aire**: hoy se aplica `detachedProgramSlide` a todo item (incluido Media). Debe bloquearse.
2. **Audio en Output**: `MediaSlideSurface` siempre renderiza el video con `muted`, también en Output. Output nunca suena.
3. **Autoplay**: no existe overlay "Activar salida" cuando el navegador bloquea el audio.
4. **Clear/Black**: Output desmonta el video al salir de `content`; al volver se remonta y salta a la posición esperada (la posición sigue la de Live, por lo que funciona, pero hay que verificarlo).

## Correcciones

### 1. Bloquear quitar Media al aire
- En Live y en Projects: si el item es `type: "media"` y es el item de Program actual (`programSlideId` pertenece a él, en cualquier modo), el botón "Quitar del rundown" queda deshabilitado con el texto `Cambia primero el contenido que está al aire.` (tooltip + mensaje al intentar por teclado).
- Guarda en la lógica pura (`removeFromLiveSession` / regla de rundown): rechaza la eliminación de Media al aire con un resultado de error; nunca crea `detachedProgramSlide` para Media.
- Songs/Bible mantienen el comportamiento actual (ADR-045).
- Si Program ya cambió a otro contenido, el item se quita normalmente y el Project se persiste.

### 2. Audio solo en Output
- `MediaSlideSurface` gana prop `audio` (por defecto `false`). Program en Live sigue muted; `OutputSurface` pasa `audio`.

### 3. "Activar salida"
- En Output, si `video.play()` con sonido es rechazado (`NotAllowedError`), se reproduce muted para mantener la posición y se muestra un overlay `Activar salida`. Un clic desbloquea el audio (quita `muted`, reintenta `play`), recuerda el desbloqueo en esa ventana y oculta el overlay.

### 4. Clear/Black
- Sin cambio de arquitectura: el playback sigue avanzando en Live; al volver a Content, Output calcula la posición con `expectedOffsetSeconds`. Solo se ajusta si la verificación muestra un fallo.

## Verificación

- Tests nuevos: quitar Media (image/video) al aire se rechaza; tras cambiar Program se permite; Songs/Bible siguen usando detached; Output nunca queda con `mediaId` eliminado.
- Playwright con MP4 y WEBM reales (generados con ffmpeg, con pista de audio): importación, miniatura, duración y dimensiones, Project, Al aire, Play/Pause/Restart/Loop, Output abierto tarde, reload de Output, dos Outputs sincronizados, Clear/Black con reanudación en la posición correcta, recarga de la app y persistencia tras borrar el archivo original.
- Audio/autoplay: headless no representa un navegador real; se verifica la lógica del overlay forzando el rechazo de `play()` y se deja una checklist breve para probar en Chrome/Edge de Windows (audio real y mover/borrar el archivo original en Windows).
- Puertas: `bun test`, typecheck, build, consola limpia en Live y Output.
- Si todo pasa: marcar Fase 10 como COMPLETADA en roadmap y docs. No se avanza a Fase 11.

## Detalles técnicos
Archivos previstos: `live-session.ts`, `rundown-rules.ts` o `projects-context.tsx` (guarda), `live-rundown.tsx`/`rundown-row.tsx` (botón deshabilitado), `media-slide-surface.tsx` (`audio`, manejo de `NotAllowedError`), `output-surface.tsx`, nuevo componente pequeño de overlay en `features/output`, tests en `tests/features` y `tests/domain`, `docs/DECISIONS.md` (ADR: Media al aire no se puede quitar), `roadmap.md`.
