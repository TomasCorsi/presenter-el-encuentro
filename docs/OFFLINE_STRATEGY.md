# Offline Strategy

## Objetivo

Permitir que una presentación preparada arranque y continúe en el mismo
dispositivo aunque Internet no esté disponible, sin introducir todavía backend,
sincronización ni backup.

## Fuentes locales de verdad

| Datos                          | Persistencia                                     |
| ------------------------------ | ------------------------------------------------ |
| Projects, Songs, Presets       | IndexedDB `broadcast-control.app`                |
| Traducciones Bible             | IndexedDB `broadcast-control.bible`              |
| Metadata y colecciones Media   | IndexedDB `broadcast-control.media`              |
| Bytes Media                    | OPFS; fallback IndexedDB Blob sólo para imágenes |
| Preferencias del dispositivo   | `localStorage`                                   |
| Sesión Live y protocolo Output | Memoria / BroadcastChannel                       |
| Relay Stream                   | Memoria del servidor local                       |

Las claves legacy de Projects, Songs y Presets se conservan como respaldo y no
se escriben después de una migración exitosa. La sesión Live no se persiste.

## Bootstrap y migraciones

`LocalDataProvider` abre `broadcast-control.app` exclusivamente en cliente. Cada
dominio migra de manera independiente y atómica: las entidades y su marcador se
escriben en la misma transacción. Un JSON corrupto nunca equivale a una biblioteca
vacía y nunca se sobrescribe. Los fallos dejan ese dominio degradado y se
reintentan en el próximo arranque.

El Service Worker no abre IndexedDB, no toca OPFS y no ejecuta migraciones.

## Service Worker

La aplicación utiliza un worker personalizado mediante `injectManifest`.

Se precachean por versión:

- bundles JS/CSS con hash;
- manifest, favicon e iconos;
- documentos de rutas críticas, incluidos Main, Stage y Stream.

Las navegaciones same-origin pueden conservarse en el cache de la versión
activa. Si una ruta no está disponible, el fallback es el documento raíz de la
misma versión. Una respuesta no exitosa no se guarda.

Nunca se cachean:

- `/api/output-relay`;
- `/api/*` y `/_serverFn/*`;
- SSE/EventSource;
- POST, PUT, PATCH o DELETE;
- recursos cross-origin dinámicos;
- OPFS, IndexedDB o URLs `blob:`.

## Outputs

- Main y Stage pueden cargar desde el cache y siguen observando BroadcastChannel
  dentro del mismo origen.
- Media se resuelve desde metadata IndexedDB y bytes OPFS locales.
- Stream puede cargar su documento transparente, pero su relay requiere el
  proceso servidor local. Sin relay queda transparente.
- El worker nunca simula el relay ni snapshots Output.

## Actualización segura

Una versión nueva se instala y queda waiting. No existe recarga automática ni
`skipWaiting` automático.

Al elegir “Aplicar actualización”:

1. se consultan las ventanas abiertas;
2. Live, Main, Stage o Stream bloquean la activación inmediata;
3. la UI pide cerrar esas ventanas;
4. en un contexto seguro se envía `SKIP_WAITING`;
5. se espera `controllerchange`;
6. sólo se recarga la pestaña que inició la operación.

Cerrar naturalmente todas las ventanas permite al navegador activar el worker
nuevo sin interrumpir una operación en curso.

## Instalación y almacenamiento

Settings informa instalación, versión, actualización, backend Media, estado de
migraciones, persistencia y cuota. `navigator.onLine` sólo informa el estado de
conectividad del navegador; no es un health check remoto.

`navigator.storage.persist()` reduce el riesgo de eviction automática, pero no
es un backup. La aplicación advierte cerca del 80% de cuota y no bloquea Live.

## Casos soportados

- Primera carga online y posterior arranque offline.
- Reload offline de rutas críticas precacheadas.
- Arranque desde la PWA instalada.
- Operación local de Projects, Songs, Presets, Bible y Media.
- Main y Stage en el mismo dispositivo sin Internet.
- Actualización diferida durante un servicio.

No se promete offline si la primera visita no completó la instalación del
worker y el precache.

## Supabase y Sync opcionales

Projects, Songs y Presets continúan leyendo y escribiendo exclusivamente
IndexedDB. Con vínculo activo, la misma transacción agrega/coalesce una operación
durable; sin sesión o sin red, CRUD, Live y Outputs siguen funcionando. Al volver
la conectividad se reanuda por eventos (boot, auth, online, visible, pageshow,
enqueue, retry due o acción manual), sin polling constante.

Los requests Supabase son cross-origin y Network Only; el Service Worker nunca
cachea Auth, REST, Realtime, Storage, tokens o respuestas cloud. La cola no
depende de Background Sync API. Reintentos transitorios usan backoff 5 s × 2^n,
tope de 15 minutos, jitter ±20 %, `Retry-After` y máximo 10 intentos. Offline no
incrementa intentos; auth pausa y validación queda como error manual.

## Fuera de alcance

- Backup/restore/exportación.
- Cloud Media y migración entre PCs.
- Persistencia de la sesión Live.
- Realtime y cleanup físico de tombstones.

Sync no es backup: replica cambios y también deletes/conflictos. Unlink archiva
estado sync sin borrar datos locales o cloud.

## Backup offline

Backup y Restore son enteramente locales: no dependen de red, Background Sync ni
Supabase. El Service Worker no intercepta archivos elegidos ni streams de backup.
File System Access escribe al destino; sin esa API se permite Blob hasta 512 MiB.

Restore suspende Sync, bloquea otras ventanas, verifica el archive y usa staging
más rollback. Sin Media se conserva metadata y las referencias faltantes siguen el
fallback normal; nunca se inventan bytes ni se consulta cloud.
