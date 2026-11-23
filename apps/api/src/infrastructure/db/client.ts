// Conexión a la base de datos con el mismo esquema Drizzle en los dos drivers:
// PGlite (local y tests, sin instalar nada) y node-postgres (Neon en producción).
// Qué driver se usa lo decide el composition root a partir de la configuración.
import { mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;

/** Base de datos con el esquema de IncidApp, sea cual sea el driver. La usan los repositorios. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export type DatabaseConfig =
  | {
      driver: 'pglite';
      /** Carpeta de datos. Sin ella, la base de datos vive en memoria (tests). */
      dataDir?: string;
    }
  | {
      driver: 'pg';
      /** Cadena de conexión (Neon). */
      url: string;
    };

export type DatabaseHandle =
  | { driver: 'pglite'; db: PgliteDatabase<Schema>; close(): Promise<void> }
  | { driver: 'pg'; db: NodePgDatabase<Schema>; close(): Promise<void> };

/** Opciones del pool de node-postgres: SSL con verificación del certificado y pocas conexiones (Neon gratuito). */
export function pgPoolConfig(url: string): pg.PoolConfig {
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: true },
    max: 5,
  };
}

export async function createDatabase(config: DatabaseConfig): Promise<DatabaseHandle> {
  if (config.driver === 'pg') {
    const pool = new pg.Pool(pgPoolConfig(config.url));
    return {
      driver: 'pg',
      db: drizzlePg({ client: pool, schema }),
      close: () => pool.end(),
    };
  }

  // PGlite no crea las carpetas intermedias (p. ej., `.data/` en un clon limpio).
  if (config.dataDir) await mkdir(config.dataDir, { recursive: true });
  const client = await PGlite.create(config.dataDir);
  return {
    driver: 'pglite',
    db: drizzlePglite({ client, schema }),
    close: async () => {
      if (!client.closed) await client.close();
    },
  };
}
