# Fase 2 — Projects

## Alcance y resultado

Implementar la primera función real del producto: gestión local de Projects con creación, listado, apertura, renombrado, duplicado, eliminación confirmada, búsqueda y selección del proyecto activo.

La fase conservará el App Shell y la dirección visual **Broadcast Control Surface**. No incluirá rundown funcional, drag & drop, contenido de presentación, IndexedDB, backend ni sincronización.

## Arquitectura propuesta

```text
Routes / Layout
      ↓
Projects feature (Provider + UI + service)
      ↓
ProjectRepository (contrato async)
      ↓
LocalStorageProjectRepository (adaptador temporal, solo cliente)
```

- **Dominio:** `Project` tendrá `id`, `workspaceId`, `name`, `itemIds`, `createdAt` y `updatedAt`. `eventDate` seguirá siendo opcional y no se solicitará. `itemIds` comenzará vacío para respetar el modelo existente sin implementar rundown.
- **Workspace temporal:** se usará un identificador local estable para el único workspace mock actual; no se implementará gestión de workspaces.
- **Repository:** contrato asíncrono para listar, obtener, crear, actualizar, duplicar y eliminar proyectos, además de leer/escribir `activeProjectId`. La forma async permitirá sustituir el adaptador por IndexedDB sin cambiar la UI.
- **Persistencia temporal:** un adaptador de `localStorage`, con clave versionada, validación defensiva al leer y acceso únicamente desde métodos ejecutados en cliente. No habrá acceso directo desde componentes.
- **Feature service:** concentrará las operaciones y reglas que coordinan el repositorio, incluida la limpieza de `activeProjectId` al eliminar el proyecto activo.
- **Estado compartido:** un `ProjectsProvider` de React, montado dentro del layout `_app`, con Context + reducer/hooks. Es necesario porque Projects, Home y Topbar deben reaccionar inmediatamente al mismo proyecto activo. No se instalará Zustand ni otra librería, y no se utilizará `src/stores/`, reservado para la Fase 4.
- **SSR:** servidor y primera hidratación parten de estado `loading`; el repositorio se carga después de montar el cliente. Así no se toca `localStorage` durante importación/render SSR ni se producen diferencias de hidratación.

## Reglas de negocio

- Nombre obligatorio tras `trim`, máximo de 100 caracteres.
- ID estable generado al ejecutar la acción de creación o duplicación.
- Fechas ISO; crear define ambas fechas y renombrar actualiza solo `updatedAt`.
- Duplicar crea una entidad independiente, con nuevo ID, fechas nuevas, copia de `itemIds` y nombre `Nombre — copia`.
- Eliminar siempre requiere confirmación.
- Eliminar el proyecto activo deja `activeProjectId` en `null`; no se selecciona otro automáticamente.
- Marcar activo no modifica el contenido del Project ni simula estado Live.
- La búsqueda será local, por nombre, sin distinguir mayúsculas/minúsculas ni espacios laterales.
- Los proyectos se presentarán ordenados por modificación más reciente; esta regla será explícita y testeada.

## Pantalla `/projects`

- Cabecera full-width con acción **Crear proyecto**.
- Sin datos: `EmptyState` compacto con la misma acción.
- Con datos: barra compacta de búsqueda y cantidad de resultados, seguida de lista/tabla densa.
- Cada fila mostrará nombre, indicador **Activo** cuando corresponda, última modificación y menú accesible.
- Abrir el nombre usará `Link` tipado hacia `/projects/$projectId`.
- Acciones por fila: abrir, marcar como activo, renombrar, duplicar y eliminar.
- Crear y renombrar compartirán un diálogo simple con un solo campo y errores visibles.
- Eliminar usará el `AlertDialog` existente. Los menús y diálogos conservarán foco, teclado y tamaños adecuados.
- En pantallas estrechas la misma información se reorganizará en filas compactas; no se convertirán en tarjetas grandes.

## Pantalla `/projects/$projectId`

- Nueva ruta tipada bajo el App Shell, con metadata propia.
- Mostrará nombre, estado activo, creación y última modificación.
- Permitirá volver a Projects y marcar el proyecto como activo.
- Incluirá una sección compacta **Rundown** con el mensaje de que se implementará posteriormente; no tendrá items, slides, drag & drop ni controles de presentación.
- Si el ID no existe o fue eliminado, mostrará un estado de “Proyecto no encontrado” con enlace de retorno. La resolución ocurre tras cargar la persistencia local para evitar un falso 404 durante hidratación.

## Home y Topbar

- Sustituirán el placeholder por el nombre real del proyecto activo.
- Sin selección mostrarán exactamente **Sin proyecto activo**.
- Home no añadirá estadísticas; conservará la composición actual y solo actualizará el bloque de contexto.
- Topbar no ganará controles nuevos; solo consumirá el contexto de Projects.

## Componentes y archivos

### Crear

- `src/domain/projects/project.ts` — modelo e inputs.
- `src/domain/projects/project-rules.ts` — validación, creación, renombrado y duplicación puros.
- `src/services/projects/project-repository.ts` — contrato y snapshot persistido.
- `src/services/projects/local-storage-project-repository.ts` — adaptador temporal e inyectable para tests.
- `src/features/projects/project-service.ts` — casos de uso y coordinación.
- `src/features/projects/projects-context.tsx` — Provider, reducer y hook público.
- `src/features/projects/components/project-list.tsx` — lista/tabla y estados de búsqueda.
- `src/features/projects/components/project-row.tsx` — fila compacta.
- `src/features/projects/components/project-dialog.tsx` — crear/renombrar.
- `src/features/projects/components/project-actions.tsx` — menú y confirmación destructiva.
- `src/routes/_app.projects.$projectId.tsx` — detalle básico.
- `src/domain/projects/project-rules.test.ts` — reglas puras.
- `src/services/projects/local-storage-project-repository.test.ts` — CRUD, persistencia y proyecto activo con almacenamiento falso.

### Modificar

- `src/routes/_app.tsx` — montar `ProjectsProvider` dentro del shell.
- `src/routes/_app.projects.tsx` — reemplazar el mock/placeholder por la pantalla real.
- `src/routes/_app.index.tsx` — leer el proyecto activo real.
- `src/components/layout/app-topbar.tsx` — mostrar el proyecto activo real.
- `src/components/layout/shell-placeholders.ts` — retirar únicamente el placeholder de proyecto activo; conservar workspace, usuario y conexión mock.
- `package.json` — añadir solo el comando `test` usando `bun test`; ninguna dependencia.
- `docs/ROADMAP.md` — marcar Fase 2 al completarse y corregir su alcance: CRUD, búsqueda, activo, detalle placeholder y persistencia temporal; mover rundown funcional/drag & drop a su fase posterior.
- `docs/DATA_MODEL.md` — documentar `activeProjectId` como estado local de sesión, no como campo de Project.
- `docs/ARCHITECTURE.md` — registrar el flujo concreto UI → feature/service → repository y la carga client-only.
- `docs/DECISIONS.md` — nueva ADR para el adaptador temporal de `localStorage` y el Context de feature sin librería global.
- `docs/TESTING.md` — aclarar que Fase 2 inicia tests de lógica con el runner de Bun, mientras Vitest/Testing Library/Playwright como tooling de proyecto siguen diferidos.

No se editará `src/routeTree.gen.ts`; TanStack Router lo regenerará.

## Tests y verificación

### Tests automatizados

- Nombre vacío, trim y longitud máxima.
- Creación: ID, workspace, fechas e `itemIds` vacío.
- Renombrado: conserva ID/creación y actualiza nombre/modificación.
- Duplicado: nueva identidad, nombre esperado, copia independiente y fechas nuevas.
- Eliminación normal y eliminación del proyecto activo.
- Lectura/escritura del repositorio, recuperación ante contenido inválido y persistencia de `activeProjectId`.
- Orden por modificación y búsqueda por nombre.

Se usará `bun test`, ya disponible, sin instalar Vitest ni librerías de DOM. Los flujos visuales se verificarán con Playwright del entorno, sin añadirlo al proyecto.

### Verificación funcional

- CRUD completo, búsqueda, selección activa y recarga del navegador.
- Navegación tipada lista ↔ detalle.
- Actualización simultánea de Projects, Home y Topbar.
- Rutas existentes sin regresiones.
- Teclado, foco y confirmación destructiva.
- Estados vacío, con datos, sin resultados, carga, error de almacenamiento y proyecto inexistente.
- Viewports 1920×1080, 1366×768 y móvil.
- Consola sin errores importantes, TypeScript estricto y sin colores literales nuevos.
- Sin dependencias añadidas.

## Documentación y correcciones de alcance

Existe una contradicción en el roadmap actual: Fase 2 todavía enumera **Rundown** y **Drag & drop**, mientras el alcance ahora aprobado los excluye y Fase 5 ya reserva el rundown funcional. Se corregirá `/docs/ROADMAP.md` para que esta petición sea la fuente de verdad vigente; no se implementarán esas dos tareas en Fase 2.

## Fuera de alcance

- Rundown funcional y reordenamiento.
- Presentation Engine, slides y elementos de presentación.
- Songs, Bible, Media, Presets, Outputs y Live funcional.
- PWA, Service Worker e IndexedDB.
- Backend, autenticación, cloud y sincronización.
- Remote y BroadcastChannel.
- Multi-workspace real, importación/exportación y colaboración.

## Decisiones y riesgos incluidos para aprobación

1. **`localStorage` temporal:** persiste en ese navegador y perfil, pero no ofrece la capacidad, transacciones ni consultas de IndexedDB. Es suficiente para metadata pequeña de Projects y quedará totalmente encapsulado.
2. **Context de feature:** es la mínima solución para compartir el proyecto activo entre shell y rutas sin contradecir la prohibición de una librería global; no se usará para Presentation Engine.
3. **Carga client-only:** evita riesgos SSR, con un estado de carga breve al abrir o recargar.
4. **Datos locales sin migración definitiva:** la clave será versionada y la lectura defensiva; no se promete migración de estos datos temporales a IndexedDB salvo que una fase futura la defina.
5. **Errores de almacenamiento:** la UI mantendrá el último estado válido y mostrará un error operativo; no afirmará que una operación se guardó si `localStorage` falla.

Aprobar este plan aprueba estas decisiones. La ejecución se detendrá al completar Fase 2 y no avanzará automáticamente.
