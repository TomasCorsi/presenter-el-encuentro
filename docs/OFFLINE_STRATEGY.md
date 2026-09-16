# Offline Strategy

## Objetivo

Garantizar que una presentación preparada pueda continuar aunque Internet se corte.

## Regla principal

Live no depende de Supabase.

## Contenido local

Guardar localmente:

- Workspace activo.
- Proyecto actual.
- Canciones necesarias.
- Biblia descargada.
- Presets.
- Configuración.
- Estado de sesión.
- Metadata de media.
- Media marcada como offline-ready.
- Cola de cambios pendientes.

## Capas

```text
UI
↓
Domain
↓
Repository
↓
IndexedDB
↓
Sync Engine
↓
Supabase
```

## Nunca hacer

```text
UI → Supabase directamente
```

para operaciones críticas de Live.

## Service Worker

Debe gestionar:

- App shell.
- Assets estáticos.
- Cache del runtime cuando corresponda.
- Estrategia de actualización.

## IndexedDB

Debe ser la fuente local de datos durante operación offline.

## Media

Los archivos grandes deben tener estado:

```text
Cloud only
Downloading
Offline ready
Error
```

El usuario debe poder descargar contenido antes del evento.

## Sync

Cuando vuelve la conexión:

```text
offline
↓
online
↓
procesar cola
↓
sincronizar
```

Sin bloquear:

- Next.
- Previous.
- Clear.
- Black.
- Logo.
- Outputs.

## Conflictos

Primera implementación:

- Detectar cambios simultáneos.
- No sobrescribir silenciosamente.
- Marcar conflicto.
- Resolver fuera de Live.

## Prueba crítica

Escenario obligatorio:

1. Preparar un proyecto.
2. Abrir Live.
3. Desconectar Internet.
4. Navegar slides.
5. Usar Clear.
6. Usar Black.
7. Mostrar Logo.
8. Abrir Main Output.
9. Continuar presentación.
10. Reconectar Internet.
11. Verificar sincronización.
