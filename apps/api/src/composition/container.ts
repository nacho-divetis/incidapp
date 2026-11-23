// Composition root: crea la conexión a la base de datos según la configuración y monta los casos de uso.
import { makeGetHealth, type GetHealth } from '../application/health/get-health';
import { createDatabase, type DatabaseHandle } from '../infrastructure/db/client';
import { createDatabaseHealth } from '../infrastructure/db/database-health';
import type { Config } from './config';

export interface Container {
  database: DatabaseHandle;
  getHealth: GetHealth;
  /** Cierra la conexión a la base de datos. */
  close(): Promise<void>;
}

export async function createContainer(config: Config): Promise<Container> {
  // PGlite sin DATABASE_URL; node-postgres con SSL con ella (la elección está en `config.database`).
  const database = await createDatabase(config.database);

  return {
    database,
    getHealth: makeGetHealth({
      databaseHealth: createDatabaseHealth(database.db),
      version: config.version,
    }),
    close: () => database.close(),
  };
}
