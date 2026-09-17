# Arreglar la importación de Biblias en .json

Tus dos archivos (NVI y RVR1960) sí tienen el formato correcto. El lector los rechaza por un detalle: espera los números de versículo como texto ("1") y en tus archivos vienen como número (1). Al no reconocer ningún versículo, concluye que no hay libros legibles y muestra el error que enviaste.

Además, con estos archivos se pierden dos datos de la ficha: el editor y el copyright vienen como objetos (`{ name: ... }`, `{ text: ... }`) y hoy solo se aceptan si son texto plano.

## Qué se corrige

1. Aceptar números de versículo tanto en texto como en número, y también rangos escritos como "3-4".
2. Aceptar el identificador de versión como número (hoy solo texto).
3. Leer editor y copyright cuando vienen como objeto: se toma el nombre del editor y el texto del copyright (nunca el HTML).
4. Mensaje de error más útil cuando el archivo sí es una Biblia pero no se pudo leer ningún versículo.

Después de esto, NVI y RVR1960 se importan, quedan instaladas y funcionan sin conexión igual que antes.

## Nota sobre el tamaño

Son archivos de 23–27 MB. La lectura ocurre en tu equipo y puede tardar unos segundos; durante la importación se mostrará el estado "Importando…" con el botón deshabilitado para que no parezca colgado.

## Detalles técnicos

- `src/domain/bible/import/usfm-items-adapter.ts`: en `readVerses`, normalizar `verse_numbers` con una función que acepte `string | number` (descartando valores no finitos); `versionId` desde `version_id` string o número; helpers `readPublisher` / `readCopyright` que resuelvan objeto (`name`, `text`, evitando `html`) o texto.
- `src/features/bible/bible-import-dialog.tsx`: estado de importación en curso (lectura + conversión + guardado) para evitar dobles clics.
- Tests en `tests/domain/bible-import.test.ts`: versículos numéricos, versículo combinado con números, publisher/copyright como objeto, `version_id` numérico. Sin dependencias nuevas.
- Verificación: `bun test`, `bunx tsgo --noEmit`, `bun run build`, y prueba en navegador importando el archivo real.
- Documentación: nota en `DECISIONS` (ADR-039) sobre tolerancia de tipos en la frontera de importación y en `TESTING`.
