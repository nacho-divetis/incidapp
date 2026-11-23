import { sql } from 'drizzle-orm';
import type { DatabaseHealth } from '../../application/ports/database-health';
import type { Database } from './client';

/** Adaptador de `DatabaseHealth`: la base de datos está bien si responde a `select 1`. */
export function createDatabaseHealth(db: Database): DatabaseHealth {
  return {
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
