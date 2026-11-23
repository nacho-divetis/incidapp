// Helper de tests: PGlite en memoria con las migraciones reales aplicadas.
// Cada llamada crea una base de datos nueva y aislada; ciérrala con `handle.close()` al terminar.
import { createDatabase, type DatabaseHandle } from './client';
import { migrateDatabase } from './migrate';

export async function createTestDatabase(): Promise<DatabaseHandle> {
  const handle = await createDatabase({ driver: 'pglite' });
  await migrateDatabase(handle);
  return handle;
}
