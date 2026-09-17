# Architecture Decisions

## ADR-001 — Local-first

### Contexto

La aplicación será utilizada durante eventos en vivo y no puede depender de Internet.

### Decisión

Las funciones críticas operarán desde almacenamiento local.

### Motivo

Evitar interrupciones por pérdida de conectividad.

### Consecuencias

Será necesario implementar persistencia y sincronización.

---

## ADR-002 — Supabase como backend cloud

### Contexto

Se necesita autenticación, base de datos, storage y sincronización.

### Decisión

Usar Supabase.

### Motivo

Reduce complejidad operativa y se integra bien con aplicaciones web modernas.

### Consecuencias

Se deberá implementar RLS y separar cloud de runtime Live.

---

## ADR-003 — IndexedDB para persistencia local

### Contexto

La aplicación será PWA y debe guardar datos offline.

### Decisión

Usar IndexedDB mediante una capa de repositorio.

### Motivo

Es el almacenamiento persistente adecuado para aplicaciones web complejas.

### Consecuencias

No acceder directamente a IndexedDB desde componentes.

---

## ADR-004 — Presentation Engine desacoplado

### Contexto

La misma presentación debe alimentar varios outputs.

### Decisión

Crear un motor central independiente del UI.

### Motivo

Permite Main, Stage, Stream y Remote sin duplicar lógica.

### Consecuencias

Las vistas deben consumir un estado compartido.

---

## ADR-005 — PWA antes que desktop nativo

### Contexto

Se busca facilidad de desarrollo, instalación desde URL y compatibilidad multiplataforma.

### Decisión

Construir primero como PWA.

### Motivo

Menor complejidad y despliegue sencillo.

### Consecuencias

Funciones nativas como NDI, DeckLink o SDI quedan fuera del MVP.

---

## ADR-006 — Desarrollo por fases

### Contexto

El proyecto tiene alcance amplio.

### Decisión

Desarrollar y validar fase por fase.

### Motivo

Reducir retrabajo, bugs y consumo innecesario de créditos.

### Consecuencias

No se avanza a la siguiente fase sin aprobación.

---

## ADR-007 — Enrutado por archivos de TanStack Start

### Contexto

La documentación inicial proponía `src/app/` y `src/pages/`, que no corresponden
al stack real del proyecto.

### Decisión

Usar el enrutado por archivos de TanStack Start en `src/routes/`.

### Motivo

Es el enrutado nativo del stack; evita capas propias innecesarias y habilita
code splitting y SSR sin configuración extra.

### Consecuencias

`src/routeTree.gen.ts` es generado y no se edita. Los outputs se definen como
rutas independientes (`output.main.tsx`, etc.).

---

## ADR-008 — Estado global diferido a la Fase 4

### Contexto

Los documentos mencionan Zustand o equivalente.

### Decisión

No instalar ninguna librería de estado global hasta la Fase 4, cuando el
Presentation Engine lo requiera realmente.

### Motivo

Evitar sobreingeniería y dependencias sin uso.

### Consecuencias

Las Fases 1–3 usan estado local de componente y el estado de servidor que
provee el stack.

---

## ADR-009 — Tokens semánticos como única fuente de color

### Contexto

El design system define tokens conceptuales (`surface`, `live`, `offline`...).

### Decisión

Todos los colores se definen como tokens semánticos en `src/styles.css` y se
consumen mediante clases semánticas. Prohibido usar colores literales en los
componentes.

### Motivo

Coherencia visual, tema oscuro consistente y cambios centralizados.

### Consecuencias

Añadir un color implica registrar el token antes de usarlo.

---

## ADR-010 — BroadcastChannel: decisión PROVISIONAL

### Contexto

Los outputs (Main, Stage, Stream) se abren como ventanas o pestañas separadas y
necesitan recibir el estado de presentación.

### Decisión

Provisional: usar BroadcastChannel para sincronizar ventanas y pestañas del
MISMO dispositivo.

Esta decisión NO es definitiva y queda pendiente de validación técnica en la
Fase 6.

### Motivo

Es la vía más simple y de menor latencia dentro de un mismo navegador, sin
dependencias ni red.

### Consecuencias

- No sirve para dispositivos distintos.
- El Mobile Remote (Fase 15) y cualquier control entre dispositivos requerirán
  otro canal, que se definirá en una fase posterior.
- El transporte debe quedar aislado tras una interfaz, para poder sustituirlo
  sin tocar el Presentation Engine ni los outputs.
- Solo puede instanciarse en cliente (ver regla SSR en ARCHITECTURE.md).

---

## ADR-011 — Persistencia temporal de Projects y estado compartido

### Contexto

Fase 2 necesita CRUD real y conservar el proyecto activo tras recargas, pero
IndexedDB y sincronización todavía están fuera de alcance.

### Decisión

Usar temporalmente `localStorage` detrás de un `ProjectRepository` asíncrono.
Compartir su snapshot mediante un Context de React limitado a Projects, sin
añadir una librería de estado ni utilizar el store del Presentation Engine.

El repository contiene únicamente persistencia. La duplicación y las demás
reglas de negocio permanecen en dominio/servicio.

### Consecuencias

- La UI no accede directamente al almacenamiento.
- El adaptador solo se crea y lee en cliente para mantener compatibilidad SSR.
- `activeProjectId` es local al workspace/dispositivo y no está sincronizado.
- La decisión sobre sincronizarlo o mantenerlo por dispositivo queda pendiente.
- Los datos temporales no garantizan migración automática a IndexedDB.
