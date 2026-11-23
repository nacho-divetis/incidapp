// Esquema de la base de datos (Drizzle). Tras cualquier cambio: `npm run db:generate`.
// Las migraciones de `apps/api/drizzle/` se generan, nunca se escriben a mano.
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Departamentos de la empresa ficticia (DIR, ADM, COM…). */
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Roles de IncidApp (mismos valores que `Role` de `@incidapp/shared`). */
export const role = pgEnum('role', ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER']);

/** Usuarios. El email se guarda normalizado (sin espacios y en minúsculas). */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  /** Hash argon2id; nunca la contraseña en claro. */
  passwordHash: text('password_hash').notNull(),
  role: role('role').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Departamentos a los que pertenece cada usuario. */
export const userDepartments = pgTable(
  'user_departments',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.departmentId] })],
);

/** Sesiones abiertas (ADR-003). `id` es el SHA-256 del *token* de la cookie, no el *token*. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/**
 * Auditoría: **solo de inserción** (RNF-09). El actor no tiene *cascade*: los usuarios se
 * desactivan, no se borran.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_created_at_idx').on(table.createdAt)],
);
