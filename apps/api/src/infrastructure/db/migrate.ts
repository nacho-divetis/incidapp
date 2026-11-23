// Aplica las migraciones generadas por drizzle-kit (`apps/api/drizzle/`). Es idempotente:
// drizzle registra las aplicadas en `drizzle.__drizzle_migrations` y solo ejecuta las nuevas.
import { fileURLToPath } from 'node:url';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { DatabaseHandle } from './client';

/**
 * Carpeta de migraciones, relativa a este archivo fuente. Las migraciones se ejecutan siempre
 * desde el código fuente con `tsx` (`npm run db:migrate`), nunca desde el bundle de `dist/`.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

export async function migrateDatabase(
  handle: DatabaseHandle,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  if (handle.driver === 'pg') {
    await migratePg(handle.db, { migrationsFolder });
  } else {
    await migratePglite(handle.db, { migrationsFolder });
  }
}
