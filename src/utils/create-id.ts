type CryptoSource = Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">>;

let legacySequence = 0;

function legacyRandomBytes(bytes: Uint8Array): void {
  // Último recurso para tests/runtimes legacy sin Web Crypto. No se usa cuando
  // getRandomValues está disponible y queda encapsulado para no dispersar una
  // fuente débil por el dominio.
  legacySequence = (legacySequence + 1) >>> 0;
  let state = (Date.now() ^ legacySequence) >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) >>> 0;
    bytes[index] = (state ^ Math.floor(Math.random() * 256)) & 0xff;
  }
}

function formatUuidV4(bytes: Uint8Array): string {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** UUID v4 para IDs locales, seguro en browser, PWA, LAN, SSR y tests. */
export function createUuid(): string {
  const source = globalThis.crypto as CryptoSource | undefined;
  if (typeof source?.randomUUID === "function") return source.randomUUID.call(source);

  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
  else legacyRandomBytes(bytes);
  return formatUuidV4(bytes);
}
