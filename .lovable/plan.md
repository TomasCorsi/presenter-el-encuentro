# Fase 9 — Bible

Sistema bíblico local y offline: importar Biblias desde archivos `.json`, dejarlas
instaladas en el dispositivo, navegar por libro/capítulo/versículo, seleccionar un
pasaje, previsualizarlo y agregarlo al rundown para que Live y Output lo traten
exactamente igual que una canción.

## Decisiones acordadas

- Versículos multilínea: se conservan los saltos de línea del archivo original.
- Un rango genera **un versículo por slide**, cada una con su referencia.
- Almacenamiento: **IndexedDB, solo para Bible** (el resto sigue en el
  almacenamiento local actual hasta la Fase 12). Se registra como excepción.
- Búsqueda: **solo por referencia** ("Juan 3:16", "Sal 23"). Búsqueda de texto
  completo queda fuera de esta fase.

## Flujo de datos

```text
Archivo .json  →  Import Adapter  →  Canonical Bible  →  IndexedDB
                                                          ↓
                                                    BibleRepository
                                                          ↓
                                              Bible UI / agregar a Project
                                                          ↓
                                              Passage → PresentationItem
                                                          ↓
                                                    Live → Output
```

Bible no conoce Live ni Output. Live no toca IndexedDB. Output no conoce Bible.

## 1. Pantalla /bible

- **Biblias instaladas**: nombre, abreviatura, idioma, número de libros,
  publisher y estado. Acciones por fila: Abrir y Eliminar (con confirmación).
- Botón **+ Importar Biblia**.
- Estado vacío compacto, con el mismo lenguaje visual de Songs y Presets.

### Importar

1. El usuario elige un archivo `.json` desde su equipo (todo se lee en el
   navegador; nada se envía a ningún servidor).
2. Se detecta el formato y se valida la estructura y la metadata.
3. Se convierte al modelo canónico interno.
4. Se muestra una vista previa: nombre, abreviatura, idioma, publisher,
   copyright y cantidad de libros.
5. El usuario confirma y la Biblia queda instalada y disponible sin Internet.
6. Errores claros y accionables: archivo ilegible, formato no soportado,
   estructura inválida, versión ya instalada, espacio insuficiente.

Importar una Biblia ya instalada pide confirmación para reemplazarla.

## 2. Navegador bíblico

`/bible/$versionId`: tres zonas con scroll propio y densidad de trabajo, en la
línea del espacio Live.

- Libros (agrupados Antiguo/Nuevo Testamento).
- Capítulos del libro elegido.
- Versículos del capítulo, con número y texto.

Selección: clic en un versículo lo selecciona; clic con Shift extiende el rango
dentro del mismo capítulo. Campo de referencia para saltar directo
("Juan 3:16", "jn 3:16-18", "Sal 23"), tolerante a abreviaturas y acentos.

Panel de pasaje seleccionado: referencia resultante, número de versículos,
vista previa con el renderer compartido (mismo que Live y Output) y el botón
**Agregar al proyecto**, que usa el proyecto activo y permite elegir otro.

## 3. Bible en el rundown y en Live

- El rundown acepta items de tipo `bible`, con la referencia como título.
- Cada item guarda el pasaje completo (texto incluido) en el momento de
  agregarlo: es autosuficiente.
- Conversión: un versículo = una slide, con las líneas originales; la
  referencia viaja como texto secundario visible en la proyección.
- Presets se aplican por aparición igual que en las canciones; Live, TAKE,
  auto-advance, Clear/Black y Output Main funcionan sin cambios.
- **Eliminar una traducción no rompe los proyectos.** Se advierte al usuario,
  se borra la traducción y los pasajes ya agregados siguen funcionando con su
  copia guardada: Live, TAKE y Output intactos. Nada reescribe los proyectos.
  La traducción instalada solo hace falta para navegar `/bible` y crear
  pasajes nuevos.
- "Contenido faltante" aparece únicamente si la copia guardada del pasaje
  falta o está corrupta.

## Detalles técnicos

- Dominio nuevo `src/domain/bible/`: `BibleVersionMeta`, `BibleBook`,
  `BibleChapter`, `BibleVerse` (`lines: string[]`), `BiblePassage`, reglas de
  parseo/formateo de referencias y `passageToPresentationItem` (puro, espejo de
  `songToPresentationItem`).
- `src/domain/bible/import/`: tipos `ExternalBibleJson` y
  `BibleImportAdapter`; primera implementación para el formato con
  `version_id`, `local_abbreviation`, `local_title`, `language`, `publisher`,
  `copyright`, `books[] → chapters[] → items[]`. Se descartan `chapter_html`,
  marcado HTML, enlaces previous/next y metadata duplicada. Registro de
  adaptadores por detección, para admitir otros formatos sin tocar dominio ni UI.
- `src/services/bible/`: `BibleRepository` asíncrono (listar versiones,
  obtener metadata, obtener capítulo, obtener pasaje, instalar, eliminar) con
  implementación IndexedDB propia, sin dependencias nuevas. Metadata y libros
  separados del texto por capítulo, para no cargar una Biblia entera en memoria.
  Adaptador en memoria para tests.
- `src/features/bible/`: `BibleProvider` (solo metadata de versiones instaladas)
  montado en el App Shell junto a Projects, Songs y Presets; el texto se carga
  bajo demanda por capítulo. Componentes de lista, importador, navegador y panel
  de pasaje.
- `RundownItem` gana el soporte real de `type: "bible"`; el pasaje resuelto vive
  en el item (`payload`) porque no hay entidad de origen editable. Migración de
  almacenamiento de Projects solo si el esquema lo requiere; los proyectos
  existentes siguen siendo válidos.
- `projectToPresentation` incorpora la rama `bible` leyendo únicamente el
  payload del item: nunca consulta `BibleRepository`. El Presentation Engine y
  Live tampoco lo hacen.
- `Slide` gana `secondaryText?: string` genérico (`label` sigue siendo interno,
  para la rejilla). El renderer compartido lo pinta como línea secundaria
  discreta bajo el texto principal, y viaja en `OutputSnapshot`. En Bible
  contiene `Juan 3:16 · NVI`; las canciones no lo usan.
- SSR: IndexedDB y la lectura de archivos solo tras el montaje en cliente.
- Sin dependencias nuevas, sin backend, sin peticiones de red.

## Testing

- Adaptador de importación: archivo válido, campos faltantes, formato
  desconocido, HTML descartado, versículos multilínea, numeraciones con letra
  o rangos combinados.
- Repositorio IndexedDB: instalar, listar, leer capítulo, eliminar, reemplazar.
- Parseo de referencias: nombre completo, abreviatura, acentos, rango, rango
  inválido, capítulo fuera de límites.
- `passageToPresentationItem`: una slide por versículo, líneas conservadas,
  texto secundario con referencia y abreviatura.
- Integración: pasaje en el rundown → Live → TAKE → Output Main.
- Traducción eliminada: el pasaje ya agregado sigue generando sus slides, se
  abre en Live, admite TAKE y llega a Output; el proyecto no se reescribe.
- Payload ausente o corrupto: ese sí aparece como contenido faltante.
- Verificación en navegador con una Biblia real importada, en 1920×1080 y
  1366×768, con la consola limpia.

## Documentación

Actualizar ROADMAP (Fase 9 completada), DATA_MODEL (modelo canónico y pasaje),
ARCHITECTURE (capa de importación y repositorio), OFFLINE_STRATEGY (Biblia
instalada), TESTING y DECISIONS con nuevos ADR: modelo canónico separado del
formato externo, IndexedDB solo para Bible, pasaje congelado en el rundown, un
versículo por slide y búsqueda solo por referencia.

## Fuera de alcance

Búsqueda de texto completo, descarga de Biblias en línea, comparación de
versiones, notas y referencias cruzadas, resaltados, historial de pasajes y
edición del texto bíblico.
