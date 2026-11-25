import { and, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { IncidentVisibilityScope } from '../../../application/authorization/authorization-policy';
import type {
  IncidentListFilters,
  IncidentRecord,
  IncidentRepository,
} from '../../../application/ports/incident-repository';
import type { Database } from '../client';
import { departments, incidents, incidentTypes, users } from '../schema';
import { isUuid } from './uuid';

const creator = alias(users, 'creator');
const assignee = alias(users, 'assignee');

const columns = {
  id: incidents.id,
  code: incidents.code,
  title: incidents.title,
  description: incidents.description,
  typeId: incidentTypes.id,
  typeCode: incidentTypes.code,
  typeName: incidentTypes.name,
  departmentId: departments.id,
  departmentCode: departments.code,
  departmentName: departments.name,
  priority: incidents.priority,
  status: incidents.status,
  creatorId: creator.id,
  creatorName: creator.name,
  assigneeId: assignee.id,
  assigneeName: assignee.name,
  dueDate: incidents.dueDate,
  createdAt: incidents.createdAt,
  updatedAt: incidents.updatedAt,
  resolvedAt: incidents.resolvedAt,
  closedAt: incidents.closedAt,
};

/** Incidencias con su tipo, departamento, creador y asignado (este último, opcional). */
const selectIncidents = (db: Database) =>
  db
    .select(columns)
    .from(incidents)
    .innerJoin(incidentTypes, eq(incidentTypes.id, incidents.typeId))
    .innerJoin(departments, eq(departments.id, incidents.departmentId))
    .innerJoin(creator, eq(creator.id, incidents.createdBy))
    .leftJoin(assignee, eq(assignee.id, incidents.assignedTo));

type Row = Awaited<ReturnType<typeof selectIncidents>>[number];

function toRecord(row: Row): IncidentRecord {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    type: { id: row.typeId, code: row.typeCode, name: row.typeName },
    department: { id: row.departmentId, code: row.departmentCode, name: row.departmentName },
    priority: row.priority,
    status: row.status,
    createdBy: { id: row.creatorId, name: row.creatorName },
    assignee:
      row.assigneeId !== null && row.assigneeName !== null
        ? { id: row.assigneeId, name: row.assigneeName }
        : null,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
  };
}

/**
 * Traduce a SQL el `scope` que decide la `AuthorizationPolicy`: este adaptador no tiene reglas de
 * visibilidad propias. Admin y Dirección: sin condición.
 */
function scopeCondition(scope: IncidentVisibilityScope): SQL | undefined {
  if (scope.kind === 'all') return undefined;
  const visible = [eq(incidents.createdBy, scope.userId), eq(incidents.assignedTo, scope.userId)];
  if (scope.departmentIds.length > 0) {
    visible.push(inArray(incidents.departmentId, [...scope.departmentIds]));
  }
  return or(...visible);
}

/** `q` se busca literalmente: `%`, `_` y `\` no son comodines. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

function filterConditions(filters: IncidentListFilters): (SQL | undefined)[] {
  return [
    filters.status ? eq(incidents.status, filters.status) : undefined,
    filters.priority ? eq(incidents.priority, filters.priority) : undefined,
    filters.departmentId ? eq(incidents.departmentId, filters.departmentId) : undefined,
    filters.assignedToId ? eq(incidents.assignedTo, filters.assignedToId) : undefined,
    filters.q
      ? or(
          ilike(incidents.code, likePattern(filters.q)),
          ilike(incidents.title, likePattern(filters.q)),
        )
      : undefined,
  ];
}

/** Adaptador Drizzle de `IncidentRepository`. Recibe la base de datos o una transacción. */
export function createDrizzleIncidentRepository(db: Database): IncidentRepository {
  const select = () => selectIncidents(db);

  async function findById(id: string): Promise<IncidentRecord | null> {
    // Un id que no es un UUID no existe (Postgres rechazaría la consulta): 404, no 500 (CA-03.6).
    if (!isUuid(id)) return null;
    const [row] = await select().where(eq(incidents.id, id));
    return row ? toRecord(row) : null;
  }

  async function getById(id: string): Promise<IncidentRecord> {
    const incident = await findById(id);
    if (!incident) throw new Error(`No existe la incidencia ${id}`);
    return incident;
  }

  return {
    findById,

    async findByIdForUpdate(id) {
      if (!isUuid(id)) return null;
      // Solo se bloquea la fila de `incidents` (`OF incidents`): Postgres no admite `FOR UPDATE`
      // sobre el lado opcional del LEFT JOIN del asignado.
      const [row] = await select().where(eq(incidents.id, id)).for('update', { of: incidents });
      return row ? toRecord(row) : null;
    },

    async list({ scope, filters, page, pageSize }) {
      const where = and(scopeCondition(scope), ...filterConditions(filters));
      const [rows, [totals]] = await Promise.all([
        select()
          .where(where)
          .orderBy(desc(incidents.createdAt), desc(incidents.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: count() }).from(incidents).where(where),
      ]);
      return { items: rows.map(toRecord), total: totals?.total ?? 0 };
    },

    async create(data) {
      const [row] = await db
        .insert(incidents)
        .values({
          code: data.code,
          title: data.title,
          description: data.description,
          typeId: data.typeId,
          departmentId: data.departmentId,
          priority: data.priority,
          status: data.status,
          createdBy: data.createdById,
          dueDate: data.dueDate,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        })
        .returning({ id: incidents.id });
      if (!row) throw new Error('No se ha insertado la incidencia');
      return getById(row.id);
    },

    async update(id, changes) {
      await db
        .update(incidents)
        .set({
          title: changes.title,
          description: changes.description,
          priority: changes.priority,
          dueDate: changes.dueDate,
          assignedTo: changes.assignedToId,
          status: changes.status,
          resolvedAt: changes.resolvedAt,
          closedAt: changes.closedAt,
          updatedAt: changes.updatedAt,
        })
        .where(eq(incidents.id, id));
      return getById(id);
    },
  };
}
