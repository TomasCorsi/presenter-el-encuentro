/**
 * Único punto de contacto con la Window Management API del navegador.
 *
 * Reglas del servicio:
 * - Feature detection siempre: ningún navegador se asume compatible.
 * - `getScreenDetails()` SOLO se llama desde un gesto explícito del usuario,
 *   porque es la llamada que dispara la solicitud de permiso.
 * - Las referencias nativas (`ScreenDetailed`) se conservan en memoria durante
 *   la sesión; a localStorage solo viaja el modelo normalizado.
 */

/** Modelo normalizado: serializable, comparable y apto para la UI. */
export interface ScreenInfo {
  label: string;
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  availLeft: number;
  availTop: number;
  devicePixelRatio: number;
  isPrimary: boolean;
}

/** Huella persistida del proyector: el mismo modelo normalizado. */
export type ScreenFingerprint = ScreenInfo;

/** Pantalla detectada: modelo para la UI + referencia nativa de la sesión. */
export interface ScreenEntry {
  info: ScreenInfo;
  native: ScreenDetailed;
}

export interface WindowManagementSupport {
  /** `window.getScreenDetails` existe. */
  hasApi: boolean;
  /** Contexto seguro (HTTPS o localhost) según el propio navegador. */
  secureContext: boolean;
  /** `screen.isExtended`: `null` cuando el navegador no lo expone. */
  extended: boolean | null;
}

export type WindowManagementPermission = PermissionState | "unknown";

export function detectWindowManagementSupport(): WindowManagementSupport {
  if (typeof window === "undefined") {
    return { hasApi: false, secureContext: false, extended: null };
  }
  return {
    hasApi: typeof window.getScreenDetails === "function",
    secureContext: window.isSecureContext === true,
    extended: typeof window.screen?.isExtended === "boolean" ? window.screen.isExtended : null,
  };
}

/**
 * Estado del permiso `window-management`. Nunca lanza: los navegadores que no
 * conocen el nombre del permiso rechazan la consulta.
 */
export async function readWindowManagementPermission(): Promise<WindowManagementPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: "window-management" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

export function describeScreen(screen: ScreenDetailed): ScreenInfo {
  return {
    label: typeof screen.label === "string" ? screen.label : "",
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    availLeft: screen.availLeft,
    availTop: screen.availTop,
    devicePixelRatio: typeof screen.devicePixelRatio === "number" ? screen.devicePixelRatio : 1,
    isPrimary: screen.isPrimary === true,
  };
}

/**
 * Pide las pantallas. Devuelve `null` si la API no existe o el usuario deniega
 * el permiso: la UI decide qué explicar, el servicio nunca lanza.
 */
export async function requestScreenDetails(): Promise<ScreenDetails | null> {
  if (typeof window === "undefined" || typeof window.getScreenDetails !== "function") return null;
  try {
    return await window.getScreenDetails();
  } catch {
    return null;
  }
}

export function toScreenEntries(details: ScreenDetails): ScreenEntry[] {
  return details.screens.map((native) => ({ info: describeScreen(native), native }));
}

export function fingerprintScreen(info: ScreenInfo): ScreenFingerprint {
  return { ...info };
}

export type ScreenMatch =
  | { status: "exact" | "label" | "geometry"; index: number }
  | { status: "ambiguous" | "missing"; index: null };

function sameGeometry(a: ScreenInfo, b: ScreenInfo): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.availWidth === b.availWidth &&
    a.availHeight === b.availHeight &&
    a.availLeft === b.availLeft &&
    a.availTop === b.availTop
  );
}

function sameExact(a: ScreenInfo, b: ScreenInfo): boolean {
  return (
    sameGeometry(a, b) &&
    a.label === b.label &&
    a.devicePixelRatio === b.devicePixelRatio &&
    a.isPrimary === b.isPrimary
  );
}

/**
 * Emparejado conservador (precisión 6 del plan aprobado): ante la duda no se
 * elige nada y jamás se cae en la pantalla principal.
 *
 * 1. Coincidencia exacta.
 * 2. Etiqueta + resolución + posición.
 * 3. Resolución + posición, solo si hay UNA candidata no principal.
 * 4. Varias candidatas → ambigua: se pide elegir de nuevo.
 */
export function matchScreen(fingerprint: ScreenFingerprint, screens: ScreenInfo[]): ScreenMatch {
  const exact = screens.findIndex((info) => sameExact(info, fingerprint));
  if (exact !== -1) return { status: "exact", index: exact };

  if (fingerprint.label !== "") {
    const labelled = indexesOf(
      screens,
      (info) => info.label === fingerprint.label && sameGeometry(info, fingerprint),
    );
    if (labelled.length === 1) return { status: "label", index: labelled[0]! };
    if (labelled.length > 1) return { status: "ambiguous", index: null };
  }

  const geometric = indexesOf(
    screens,
    (info) => !info.isPrimary && sameGeometry(info, fingerprint),
  );
  if (geometric.length === 1) return { status: "geometry", index: geometric[0]! };
  if (geometric.length > 1) return { status: "ambiguous", index: null };

  return { status: "missing", index: null };
}

function indexesOf(screens: ScreenInfo[], predicate: (info: ScreenInfo) => boolean): number[] {
  const found: number[] = [];
  screens.forEach((info, index) => {
    if (predicate(info)) found.push(index);
  });
  return found;
}

/**
 * Sugerencia automática: con exactamente dos pantallas, la no principal es el
 * proyector. Con otra cantidad no se propone nada (el operador elige).
 */
export function suggestAudienceScreen(screens: ScreenInfo[]): number | null {
  if (screens.length !== 2) return null;
  const index = screens.findIndex((info) => !info.isPrimary);
  return index === -1 ? null : index;
}

/**
 * Escucha los cambios de configuración de pantallas: el conjunto completo
 * (`screenschange`) y cada pantalla por separado (`change`). Devuelve la
 * limpieza de TODOS los listeners registrados.
 */
export function subscribeScreenChanges(details: ScreenDetails, onChange: () => void): () => void {
  const bindings: Array<{ target: EventTarget; event: string }> = [
    { target: details, event: "screenschange" },
    ...details.screens.map((screen) => ({ target: screen as EventTarget, event: "change" })),
  ];

  for (const { target, event } of bindings) target.addEventListener(event, onChange);

  return () => {
    for (const { target, event } of bindings) target.removeEventListener(event, onChange);
  };
}
