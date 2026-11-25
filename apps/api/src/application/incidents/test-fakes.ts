// Fakes en memoria de las incidencias, solo para los tests de aplicación.
import type { IncidentTypeSummary, UserSummary } from '@incidapp/shared';
import { FixedClock } from '../auth/test-fakes';
import type { IncidentAccessFacts } from '../authorization/authorization-policy';
import type { IncidentCodeCounter } from '../ports/incident-code-counter';
import type { IncidentEventWriter, NewIncidentEvent } from '../ports/incident-event-writer';
import type {
  IncidentChanges,
  IncidentListQueryData,
  IncidentRecord,
  IncidentRepository,
  NewIncidentData,
} from '../ports/incident-repository';
import type { IncidentTypeRepository } from '../ports/incident-type-repository';
import type { TransactionalRepositories, UnitOfWork } from '../ports/unit-of-work';
import {
  currentUserOf,
  DEPARTMENTS,
  InMemoryDepartments,
  InMemoryUserAdmins,
  unavailable,
  USERS,
  type StoredUser,
} from '../users/test-fakes';

export { currentUserOf, DEPARTMENTS };

export const INCIDENT_TYPES = {
  TRANSPORT: {
    id: '00000000-0000-4000-8000-0000000000b1',
    code: 'TRANSPORT',
    name: 'Transporte',
    department: DEPARTMENTS.LOG,
  },
  QUALITY: {
    id: '00000000-0000-4000-8000-0000000000b2',
    code: 'QUALITY',
    name: 'Calidad',
    department: DEPARTMENTS.CAL,
  },
  ADMINISTRATIVE: {
    id: '00000000-0000-4000-8000-0000000000b3',
    code: 'ADMINISTRATIVE',
    name: 'Administrativa',
    department: DEPARTMENTS.ADM,
  },
} satisfies Record<string, IncidentTypeSummary>;

const CREATED_AT = new Date('2026-11-01T09:00:00.000Z');

/**
 * Usuarios de los tests de incidencias: los de la gestión de usuarios (Responsable y Usuarios de
 * LOG, Admins de ADM, un desactivado de CAL) más Dirección y un desactivado de LOG.
 */
export const INCIDENT_USERS = {
  ...USERS,
  director: {
    id: '00000000-0000-4000-8000-000000000007',
    email: 'javier.ortega@incidapp.test',
    name: 'Javier Ortega',
    role: 'DIRECTOR',
    active: true,
    departments: [],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Javier-1',
  },
  inactiveLog: {
    id: '00000000-0000-4000-8000-000000000008',
    email: 'baja.log@incidapp.test',
    name: 'Ana Baja',
    role: 'USER',
    active: false,
    departments: [DEPARTMENTS.LOG],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Ana-1',
  },
} satisfies Record<string, StoredUser>;

export class InMemoryIncidentTypes implements IncidentTypeRepository {
  constructor(readonly catalog: IncidentTypeSummary[] = Object.values(INCIDENT_TYPES)) {}

  async list(): Promise<IncidentTypeSummary[]> {
    return [...this.catalog].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string): Promise<IncidentTypeSummary | null> {
    return this.catalog.find((type) => type.id === id) ?? null;
  }
}

/** Fila guardada en el *fake*: como la tabla `incidents`, con ids en lugar de relaciones. */
export interface StoredIncident {
  id: string;
  code: string;
  title: string;
  description: string;
  typeId: string;
  departmentId: string;
  priority: IncidentRecord['priority'];
  status: IncidentRecord['status'];
  createdById: string;
  assignedToId: string | null;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

const newestFirst = (a: StoredIncident, b: StoredIncident) =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);

export class InMemoryIncidents implements IncidentRepository {
  readonly rows: StoredIncident[] = [];
  private nextId = 1;

  constructor(
    private readonly types: InMemoryIncidentTypes,
    private readonly departments: InMemoryDepartments,
    private readonly users: InMemoryUserAdmins,
  ) {}

  /** Lo pone la unidad de trabajo mientras ejecuta una transacción. */
  inTransaction = false;
  /** Lecturas bloqueantes hechas (dentro de una transacción). */
  lockedReads = 0;
  /**
   * Simula una petición concurrente que confirma un cambio justo antes de que esta transacción
   * consiga el bloqueo: se aplica a la fila guardada antes de la lectura bloqueante.
   */
  concurrentChange: ((row: StoredIncident) => void) | null = null;

  async findById(id: string): Promise<IncidentRecord | null> {
    const row = this.rows.find((candidate) => candidate.id === id);
    return row ? this.toRecord(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<IncidentRecord | null> {
    if (!this.inTransaction) throw new Error('findByIdForUpdate fuera de una transacción');
    this.lockedReads += 1;
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row && this.concurrentChange) this.concurrentChange(row);
    return row ? this.toRecord(row) : null;
  }

  async list({ scope, filters, page, pageSize }: IncidentListQueryData) {
    const q = filters.q?.toLowerCase();
    const matching = this.rows
      .filter(
        (row) =>
          scope.kind === 'all' ||
          scope.departmentIds.includes(row.departmentId) ||
          row.createdById === scope.userId ||
          row.assignedToId === scope.userId,
      )
      .filter((row) => !filters.status || row.status === filters.status)
      .filter((row) => !filters.priority || row.priority === filters.priority)
      .filter((row) => !filters.departmentId || row.departmentId === filters.departmentId)
      .filter((row) => !filters.assignedToId || row.assignedToId === filters.assignedToId)
      .filter(
        (row) => !q || row.code.toLowerCase().includes(q) || row.title.toLowerCase().includes(q),
      )
      .sort(newestFirst);
    const start = (page - 1) * pageSize;
    return {
      items: matching.slice(start, start + pageSize).map((row) => this.toRecord(row)),
      total: matching.length,
    };
  }

  async create(data: NewIncidentData): Promise<IncidentRecord> {
    const row: StoredIncident = {
      id: this.newId(),
      code: data.code,
      title: data.title,
      description: data.description,
      typeId: data.typeId,
      departmentId: data.departmentId,
      priority: data.priority,
      status: data.status,
      createdById: data.createdById,
      assignedToId: null,
      dueDate: data.dueDate,
      createdAt: data.createdAt,
      updatedAt: data.createdAt,
      resolvedAt: null,
      closedAt: null,
    };
    this.rows.push(row);
    return this.toRecord(row);
  }

  async update(id: string, changes: IncidentChanges): Promise<IncidentRecord> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Incidencia ${id} inexistente en el fake`);
    if (changes.title !== undefined) row.title = changes.title;
    if (changes.description !== undefined) row.description = changes.description;
    if (changes.priority !== undefined) row.priority = changes.priority;
    if (changes.dueDate !== undefined) row.dueDate = changes.dueDate;
    if (changes.assignedToId !== undefined) row.assignedToId = changes.assignedToId;
    row.updatedAt = changes.updatedAt;
    return this.toRecord(row);
  }

  /** Guarda una incidencia tal cual, para preparar un test. El tipo sale del departamento. */
  add(fields: Partial<StoredIncident> & Pick<StoredIncident, 'departmentId' | 'createdById'>) {
    const n = this.rows.length + 1;
    const type = this.types.catalog.find((t) => t.department.id === fields.departmentId);
    const createdAt = new Date(CREATED_AT.getTime() + n * 60_000);
    const row: StoredIncident = {
      id: this.newId(),
      code: `INC-2026-${String(n).padStart(4, '0')}`,
      title: `Incidencia ${n}`,
      description: 'Descripción de prueba.',
      typeId: type?.id ?? INCIDENT_TYPES.TRANSPORT.id,
      priority: 'MEDIUM',
      status: 'OPEN',
      assignedToId: null,
      dueDate: null,
      createdAt,
      updatedAt: createdAt,
      resolvedAt: null,
      closedAt: null,
      ...fields,
    };
    this.rows.push(row);
    return row;
  }

  private newId(): string {
    return `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '7')}`;
  }

  private toRecord(row: StoredIncident): IncidentRecord {
    const type = this.types.catalog.find((t) => t.id === row.typeId);
    const department = this.departments.catalog.find((d) => d.id === row.departmentId);
    if (!type || !department) throw new Error('Relación inexistente en el fake');
    return structuredClone({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      type: { id: type.id, code: type.code, name: type.name },
      department,
      priority: row.priority,
      status: row.status,
      createdBy: this.summary(row.createdById),
      assignee: row.assignedToId ? this.summary(row.assignedToId) : null,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      closedAt: row.closedAt,
    });
  }

  private summary(id: string): UserSummary {
    const user = this.users.users.find((candidate) => candidate.id === id);
    if (!user) throw new Error(`Usuario ${id} inexistente en el fake`);
    return { id: user.id, name: user.name };
  }
}

export class InMemoryIncidentCodes implements IncidentCodeCounter {
  readonly counters = new Map<number, number>();

  async next(year: number): Promise<number> {
    const value = (this.counters.get(year) ?? 0) + 1;
    this.counters.set(year, value);
    return value;
  }
}

export class InMemoryIncidentEvents implements IncidentEventWriter {
  readonly events: NewIncidentEvent[] = [];

  async append(event: NewIncidentEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

/** Historial que falla al insertar: para comprobar que la unidad de trabajo revierte. */
export class FailingIncidentEvents extends InMemoryIncidentEvents {
  override async append(_event: NewIncidentEvent): Promise<void> {
    throw new Error('Fallo simulado del historial');
  }
}

/** Unidad de trabajo de incidencias: si `work` lanza, restaura incidencias, contadores e historial. */
export class InMemoryIncidentUnitOfWork implements UnitOfWork {
  runs = 0;
  /** Repositorios que sustituyen a los de siempre dentro de la transacción (p. ej., otra lectura). */
  transactional: Partial<TransactionalRepositories> = {};

  constructor(
    readonly users: InMemoryUserAdmins,
    readonly incidents: InMemoryIncidents,
    readonly incidentCodes: InMemoryIncidentCodes,
    public incidentEvents: InMemoryIncidentEvents,
  ) {}

  async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    this.runs += 1;
    const rows = structuredClone(this.incidents.rows);
    const counters = new Map(this.incidentCodes.counters);
    const events = [...this.incidentEvents.events];
    this.incidents.inTransaction = true;
    try {
      return await work({
        users: this.users,
        sessions: unavailable('sessions'),
        auditLog: unavailable('auditLog'),
        incidents: this.incidents,
        incidentCodes: this.incidentCodes,
        incidentEvents: this.incidentEvents,
        ...this.transactional,
      });
    } catch (error) {
      this.incidents.rows.splice(0, this.incidents.rows.length, ...rows);
      this.incidentCodes.counters.clear();
      for (const [year, value] of counters) this.incidentCodes.counters.set(year, value);
      this.incidentEvents.events.splice(0, this.incidentEvents.events.length, ...events);
      throw error;
    } finally {
      this.incidents.inTransaction = false;
    }
  }
}

export const NOW = new Date('2026-11-25T10:00:00.000Z');

/** Mundo en memoria para los casos de uso de incidencias. */
export function createIncidentWorld() {
  const departments = new InMemoryDepartments();
  const users = new InMemoryUserAdmins(
    Object.values(INCIDENT_USERS).map((user) => structuredClone(user)),
    departments,
  );
  const incidentTypes = new InMemoryIncidentTypes();
  const incidents = new InMemoryIncidents(incidentTypes, departments, users);
  const incidentCodes = new InMemoryIncidentCodes();
  const incidentEvents = new InMemoryIncidentEvents();
  const unitOfWork = new InMemoryIncidentUnitOfWork(
    users,
    incidents,
    incidentCodes,
    incidentEvents,
  );
  const clock = new FixedClock(NOW);
  return {
    departments,
    users,
    incidentTypes,
    incidents,
    incidentCodes,
    incidentEvents,
    unitOfWork,
    clock,
  };
}

export type IncidentWorld = ReturnType<typeof createIncidentWorld>;

/** Usuario actual de los tests, por clave de `INCIDENT_USERS`. */
export const actorNamed = (key: keyof typeof INCIDENT_USERS) => currentUserOf(INCIDENT_USERS[key]);

/** Hechos de acceso de una fila guardada (para cruzar resultados con la política). */
export const factsOf = (row: StoredIncident): IncidentAccessFacts => ({
  ownerDepartmentId: row.departmentId,
  createdById: row.createdById,
  assignedToId: row.assignedToId,
  status: row.status,
});
