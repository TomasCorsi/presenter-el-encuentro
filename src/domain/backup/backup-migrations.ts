export type BackupMigration = (value: unknown) => unknown;

export class BackupMigrationRegistry {
  readonly #migrations = new Map<number, BackupMigration>();

  register(fromVersion: number, migration: BackupMigration): this {
    if (!Number.isInteger(fromVersion) || fromVersion < 0 || this.#migrations.has(fromVersion)) {
      throw new Error(`Migración de backup inválida o duplicada para v${fromVersion}.`);
    }
    this.#migrations.set(fromVersion, migration);
    return this;
  }

  migrate(value: unknown, targetVersion: number): unknown {
    let current = value;
    let version = this.#readVersion(current);
    if (version > targetVersion) throw new Error(`Formato futuro v${version} no soportado.`);
    while (version < targetVersion) {
      const migration = this.#migrations.get(version);
      if (!migration)
        throw new Error(`No existe migración de backup v${version} → v${version + 1}.`);
      current = migration(current);
      const next = this.#readVersion(current);
      if (next !== version + 1) throw new Error("La migración no avanzó exactamente una versión.");
      version = next;
    }
    return current;
  }

  #readVersion(value: unknown): number {
    if (!value || typeof value !== "object") throw new Error("Manifest de backup inválido.");
    const version = (value as Record<string, unknown>)["formatVersion"];
    if (!Number.isInteger(version) || (version as number) < 0) {
      throw new Error("formatVersion inválido.");
    }
    return version as number;
  }
}
