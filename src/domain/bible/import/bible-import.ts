import type { CanonicalBible } from "../bible";

/**
 * Frontera de importación (ADR-039).
 *
 * El formato externo NUNCA entra al dominio: cada adaptador reconoce una forma
 * concreta de archivo y produce el modelo canónico. Añadir otro formato es
 * añadir un adaptador, sin tocar dominio, repositorio ni UI.
 */

export interface BibleImportDependencies {
  createId: () => string;
  now: () => string;
}

export interface BibleImportAdapter {
  /** Nombre humano del formato, usado en mensajes de error. */
  readonly formatName: string;
  /** Detección barata, sin validar el contenido completo. */
  canImport(value: unknown): boolean;
  /** Conversión estricta; lanza un Error con mensaje accionable. */
  toCanonical(value: unknown, dependencies: BibleImportDependencies): CanonicalBible;
}

export class BibleImportError extends Error {}

/** Elimina marcado HTML residual y normaliza espacios de una línea. */
export function cleanLine(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\u00a0]+/g, " ")
    .trim();
}

export function parseBibleFile(
  text: string,
  adapters: readonly BibleImportAdapter[],
  dependencies: BibleImportDependencies,
): CanonicalBible {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BibleImportError("El archivo no es un JSON válido.");
  }

  const adapter = adapters.find((candidate) => candidate.canImport(value));
  if (!adapter) {
    throw new BibleImportError(
      "El formato del archivo no es compatible todavía. Revisa que sea una Biblia exportada en JSON.",
    );
  }

  return adapter.toCanonical(value, dependencies);
}
