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
