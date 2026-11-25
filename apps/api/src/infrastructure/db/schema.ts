// Esquema de la base de datos (Drizzle). Tras cualquier cambio: `npm run db:generate`.
// Las migraciones de `apps/api/drizzle/` se generan, nunca se escriben a mano.
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
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

/** Prioridades de una incidencia (mismos valores que `Priority` de `@incidapp/shared`). */
export const priority = pgEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

/** Estados de una incidencia (mismos valores que `Status` de `@incidapp/shared`). */
export const incidentStatus = pgEnum('incident_status', [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'REOPENED',
]);

/** Tipos de evento del historial (mismos valores que `IncidentEventType` de `@incidapp/shared`). */
export const incidentEventType = pgEnum('incident_event_type', [
  'CREATED',
  'UPDATED',
  'ASSIGNED',
  'STATUS_CHANGED',
]);

/** Catálogo de tipos de incidencia, cada uno con su departamento por defecto (fijo desde el *seed*). */
export const incidentTypes = pgTable('incident_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  defaultDepartmentId: uuid('default_department_id')
    .notNull()
    .references(() => departments.id),
});

/**
 * Incidencias. El departamento propietario lo fija el tipo al crearla. No se borran: sus usuarios y
 * su historial no tienen *cascade*.
 */
export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `INC-AAAA-NNNN`. */
    code: text('code').notNull().unique(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => incidentTypes.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    priority: priority('priority').notNull(),
    status: incidentStatus('status').notNull().default('OPEN'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    assignedTo: uuid('assigned_to').references(() => users.id),
    /** Fecha objetivo sin hora: viaja como `AAAA-MM-DD` y no se convierte de zona. */
    dueDate: date('due_date', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('incidents_department_id_idx').on(table.departmentId),
    index('incidents_created_by_idx').on(table.createdBy),
    index('incidents_assigned_to_idx').on(table.assignedTo),
    index('incidents_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Último número de código usado en cada año (CA-03.4). Se incrementa con `INSERT … ON CONFLICT …
 * RETURNING` dentro de la transacción del alta.
 */
export const codeCounters = pgTable('code_counters', {
  year: integer('year').primaryKey(),
  lastValue: integer('last_value').notNull(),
});

/** Historial de una incidencia: **solo de inserción** (no se actualiza ni se borra). */
export const incidentEvents = pgTable(
  'incident_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id),
    type: incidentEventType('type').notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('incident_events_incident_id_created_at_idx').on(table.incidentId, table.createdAt),
  ],
);
