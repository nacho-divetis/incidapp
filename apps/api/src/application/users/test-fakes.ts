// Fakes en memoria de la gestión de usuarios, solo para los tests de aplicación.
import type { CurrentUser, DepartmentSummary } from '@incidapp/shared';
import {
  FakePasswordHasher,
  FixedClock,
  InMemoryAuditLog,
  InMemorySessions,
} from '../auth/test-fakes';
import { ConflictError } from '../errors';
import type { AuditEntry } from '../ports/audit-log-writer';
import type { DepartmentRepository } from '../ports/department-repository';
import type { TransactionalRepositories, UnitOfWork } from '../ports/unit-of-work';
import type {
  ManagedUser,
  NewUserData,
  UserAdminRepository,
  UserChanges,
} from '../ports/user-admin-repository';
import { EMAIL_TAKEN_MESSAGE } from './user-messages';

/** Usuario guardado en el *fake*: el gestionado más su *hash*. */
export interface StoredUser extends ManagedUser {
  passwordHash: string;
}

export const DEPARTMENTS = {
  ADM: {
    id: '00000000-0000-4000-8000-0000000000a1',
    code: 'ADM',
    name: 'Administración y Finanzas',
  },
  CAL: { id: '00000000-0000-4000-8000-0000000000a2', code: 'CAL', name: 'Calidad' },
  LOG: { id: '00000000-0000-4000-8000-0000000000a3', code: 'LOG', name: 'Logística y Almacén' },
} satisfies Record<string, DepartmentSummary>;

const byCode = (a: DepartmentSummary, b: DepartmentSummary) => a.code.localeCompare(b.code);
const clone = (user: StoredUser): StoredUser => structuredClone(user);
const withoutHash = ({ passwordHash: _hash, ...user }: StoredUser): ManagedUser =>
  structuredClone(user);

export class InMemoryDepartments implements DepartmentRepository {
  constructor(readonly catalog: DepartmentSummary[] = Object.values(DEPARTMENTS)) {}

  async list(): Promise<DepartmentSummary[]> {
    return [...this.catalog].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findByIds(ids: readonly string[]): Promise<DepartmentSummary[]> {
    return this.catalog.filter((department) => ids.includes(department.id));
  }
}

export class InMemoryUserAdmins implements UserAdminRepository {
  private nextId = 1;

  constructor(
    readonly users: StoredUser[],
    private readonly departments: InMemoryDepartments,
  ) {}

  async list(): Promise<ManagedUser[]> {
    return [...this.users].sort((a, b) => a.name.localeCompare(b.name)).map(withoutHash);
  }

  async findById(id: string): Promise<ManagedUser | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? withoutHash(user) : null;
  }

  async findByEmail(email: string): Promise<ManagedUser | null> {
    const user = this.users.find((candidate) => candidate.email === email);
    return user ? withoutHash(user) : null;
  }

  async create(data: NewUserData): Promise<ManagedUser> {
    this.assertEmailFree(data.email, null);
    const user: StoredUser = {
      id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '9')}`,
      email: data.email,
      name: data.name,
      role: data.role,
      active: true,
      departments: this.departmentsOf(data.departmentIds),
      createdAt: data.createdAt,
      passwordHash: data.passwordHash,
    };
    this.users.push(user);
    return withoutHash(user);
  }

  async update(id: string, changes: UserChanges): Promise<ManagedUser> {
    const user = this.get(id);
    if (changes.email !== undefined) this.assertEmailFree(changes.email, id);
    if (changes.email !== undefined) user.email = changes.email;
    if (changes.name !== undefined) user.name = changes.name;
    if (changes.role !== undefined) user.role = changes.role;
    if (changes.departmentIds !== undefined) {
      user.departments = this.departmentsOf(changes.departmentIds);
    }
    return withoutHash(user);
  }

  async setActive(id: string, active: boolean): Promise<ManagedUser> {
    const user = this.get(id);
    user.active = active;
    return withoutHash(user);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    this.get(id).passwordHash = passwordHash;
  }

  private get(id: string): StoredUser {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) throw new Error(`Usuario ${id} inexistente en el fake`);
    return user;
  }

  private assertEmailFree(email: string, exceptId: string | null): void {
    if (this.users.some((user) => user.email === email && user.id !== exceptId)) {
      throw new ConflictError(EMAIL_TAKEN_MESSAGE);
    }
  }

  private departmentsOf(ids: readonly string[]): DepartmentSummary[] {
    return this.departments.catalog.filter((d) => ids.includes(d.id)).sort(byCode);
  }
}

/** Auditoría que falla al registrar: para comprobar que la unidad de trabajo revierte. */
export class FailingAuditLog extends InMemoryAuditLog {
  override async record(_entry: AuditEntry): Promise<void> {
    throw new Error('Fallo simulado de la auditoría');
  }
}

/**
 * Unidad de trabajo en memoria con la semántica de una transacción: si `work` lanza, restaura los
 * usuarios, las sesiones y la auditoría como estaban antes.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  runs = 0;

  constructor(
    readonly users: InMemoryUserAdmins,
    readonly sessions: InMemorySessions,
    public auditLog: InMemoryAuditLog,
  ) {}

  async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    this.runs += 1;
    const users = this.users.users.map(clone);
    const sessions = new Map(this.sessions.sessions);
    const entries = [...this.auditLog.entries];
    try {
      return await work({ users: this.users, sessions: this.sessions, auditLog: this.auditLog });
    } catch (error) {
      this.users.users.splice(0, this.users.users.length, ...users);
      this.sessions.sessions.clear();
      for (const [id, session] of sessions) this.sessions.sessions.set(id, session);
      this.auditLog.entries.splice(0, this.auditLog.entries.length, ...entries);
      throw error;
    }
  }
}

/** Usuario actual de cada rol para los tests. */
export const currentUserOf = (
  user: Pick<StoredUser, 'id' | 'email' | 'name' | 'role' | 'departments'>,
): CurrentUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  departments: user.departments,
  allowedActions: [],
});

export const NOW = new Date('2026-11-23T10:00:00.000Z');
export const IP = '203.0.113.7';
const CREATED_AT = new Date('2026-11-01T09:00:00.000Z');

/** Usuarios de partida: los demo protegidos y otros normales (ficticios). */
export const USERS = {
  /** Admin demo: protegido (solo `rename`). */
  demoAdmin: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@incidapp.test',
    name: 'Elena Ruiz',
    role: 'ADMIN',
    active: true,
    departments: [DEPARTMENTS.ADM],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Demo2026!',
  },
  /** Admin que no es demo: para las reglas sobre uno mismo. */
  admin: {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'marta.lopez@incidapp.test',
    name: 'Marta López',
    role: 'ADMIN',
    active: true,
    departments: [DEPARTMENTS.ADM],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Marta-1',
  },
  worker: {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'lucia.gomez@incidapp.test',
    name: 'Lucía Gómez',
    role: 'USER',
    active: true,
    departments: [DEPARTMENTS.LOG],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Lucia-1',
  },
  inactive: {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'baja@incidapp.test',
    name: 'Andrés Baja',
    role: 'USER',
    active: false,
    departments: [DEPARTMENTS.CAL],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Baja-1',
  },
  /** Usuario demo: protegido. */
  demoUser: {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'usuario@incidapp.test',
    name: 'Pablo Moreno',
    role: 'USER',
    active: true,
    departments: [DEPARTMENTS.LOG],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Demo2026!',
  },
  manager: {
    id: '00000000-0000-4000-8000-000000000006',
    email: 'jorge.sanz@incidapp.test',
    name: 'Jorge Sanz',
    role: 'MANAGER',
    active: true,
    departments: [DEPARTMENTS.LOG],
    createdAt: CREATED_AT,
    passwordHash: 'fake:Clave-Jorge-1',
  },
} satisfies Record<string, StoredUser>;

/** Mundo en memoria para los casos de uso: repositorios, unidad de trabajo, *hasher* y reloj. */
export function createUserAdminWorld() {
  const departments = new InMemoryDepartments();
  const users = new InMemoryUserAdmins(Object.values(USERS).map(clone), departments);
  const sessions = new InMemorySessions();
  const auditLog = new InMemoryAuditLog();
  const unitOfWork = new InMemoryUnitOfWork(users, sessions, auditLog);
  const passwordHasher = new FakePasswordHasher();
  const clock = new FixedClock(NOW);
  /** Usuario guardado (con *hash*) tal como está ahora. */
  const stored = (id: string): StoredUser | undefined => users.users.find((u) => u.id === id);
  /** Abre una sesión de `userId` (para comprobar que se borran). */
  const openSession = (userId: string, id = `s-${userId}`) =>
    sessions.create({ id, userId, expiresAt: new Date(NOW.getTime() + 3_600_000), createdAt: NOW });
  return {
    departments,
    users,
    sessions,
    auditLog,
    unitOfWork,
    passwordHasher,
    clock,
    stored,
    openSession,
  };
}

export type UserAdminWorld = ReturnType<typeof createUserAdminWorld>;
