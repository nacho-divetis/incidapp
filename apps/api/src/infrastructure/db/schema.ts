// Esquema de la base de datos (Drizzle). Tras cualquier cambio: `npm run db:generate`.
// Las migraciones de `apps/api/drizzle/` se generan, nunca se escriben a mano.
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Departamentos de la empresa ficticia (DIR, ADM, COM…). */
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
