import {
  DEMO_PASSWORD,
  DEMO_USERS,
  type CurrentUser,
  type Priority,
  type Status,
} from '@incidapp/shared';
import { asc, count, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import {
  actorOf,
  canOnIncident,
  globalActionsFor,
  incidentVisibilityScope,
} from '../../application/authorization/authorization-policy';
import { makeAssignIncident } from '../../application/incidents/assign-incident';
import { makeChangeIncidentStatus } from '../../application/incidents/change-incident-status';
import { makeCreateIncident } from '../../application/incidents/create-incident';
import { transitionActionOf } from '../../application/incidents/incident-support';
import type { Clock } from '../../application/ports/clock';
import type { IncidentRecord } from '../../application/ports/incident-repository';
import { findTransition } from '../../domain/incidents/status-machine';
import { createArgon2PasswordHasher } from '../auth/argon2-password-hasher';
import { createSessionTokens } from '../auth/session-tokens';
import { systemClock } from '../clock/system-clock';
import type { Database, DatabaseHandle } from './client';
import { DEMO_INCIDENTS, DEMO_STAFF, type DemoIncident } from './demo-incidents';
import { createDrizzleAuditLogWriter } from './repositories/audit-log-writer';
import { createDrizzleIncidentEventReader } from './repositories/incident-event-reader';
import { createDrizzleIncidentRepository } from './repositories/incident-repository';
import { createDrizzleIncidentTypeRepository } from './repositories/incident-type-repository';
import { createDrizzleSessionRepository } from './repositories/session-repository';
import { createDrizzleUserRepository } from './repositories/user-repository';
import {
  codeCounters,
  departments,
  incidentEvents,
  incidents,
  incidentTypes,
  userDepartments,
  users,
} from './schema';
import { INCIDENT_TYPES, seedDatabase, seedDemoIncidents, seedDemoStaff } from './seed';
import { createTestDatabase } from './test-database';
import { createDrizzleUnitOfWork } from './unit-of-work';

const passwordHasher = createArgon2PasswordHasher();

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(async () => {
  await handle.close();
});

const seed = () => seedDatabase(handle.db, { passwordHasher });

const departmentCodes = async () =>
  (
    await handle.db
      .select({ code: departments.code })
      .from(departments)
      .orderBy(asc(departments.code))
  ).map((row) => row.code);

const userRows = () => handle.db.select().from(users).orderBy(asc(users.email));

/** Códigos de departamento de cada usuario, por email. */
async function departmentsByEmail(): Promise<Record<string, string[]>> {
  const rows = await handle.db
    .select({ email: users.email, code: departments.code })
    .from(userDepartments)
    .innerJoin(users, eq(users.id, userDepartments.userId))
    .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
    .orderBy(asc(users.email), asc(departments.code));
  const result: Record<string, string[]> = {};
  for (const { email, code } of rows) (result[email] ??= []).push(code);
  return result;
}

const EXPECTED_CODES = ['ADM', 'ATC', 'CAL', 'COM', 'COMP', 'DIR', 'LOG', 'PROD', 'TEC'];

describe('seedDatabase · departamentos', () => {
  it('CA-00.9: crea los 9 departamentos de la empresa ficticia', async () => {
    await seed();

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
    const rows = await handle.db.select().from(departments);
    for (const row of rows) expect(row.name.length).toBeGreaterThan(0);
  });

  it('CA-00.9: ejecutarlo dos veces seguidas no duplica ningún departamento', async () => {
    await seed();
    await seed();

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
  });
});

/** Tipos de incidencia con el código de su dpto. por defecto, por código. */
const incidentTypeRows = async () =>
  (
    await handle.db
      .select({ code: incidentTypes.code, name: incidentTypes.name, department: departments.code })
      .from(incidentTypes)
      .innerJoin(departments, eq(departments.id, incidentTypes.defaultDepartmentId))
      .orderBy(asc(incidentTypes.code))
  ).map(({ code, name, department }) => [code, name, department]);

const EXPECTED_INCIDENT_TYPES = [
  ['ADMINISTRATIVE', 'Administrativa', 'ADM'],
  ['CUSTOMER', 'Cliente / Reclamación', 'ATC'],
  ['INTERNAL', 'Interna / Operativa', 'PROD'],
  ['QUALITY', 'Calidad', 'CAL'],
  ['SUPPLIER', 'Proveedor', 'COMP'],
  ['TECHNICAL', 'Técnica / Instalación', 'TEC'],
  ['TRANSPORT', 'Transporte', 'LOG'],
];

describe('seedDatabase · tipos de incidencia', () => {
  it('CA-03.1: crea los 7 tipos de requisitos.md con su departamento por defecto', async () => {
    await seed();

    expect(await incidentTypeRows()).toEqual(EXPECTED_INCIDENT_TYPES);
  });

  it('CA-03.1: ejecutarlo dos veces no duplica ningún tipo ni cambia sus ids', async () => {
    await seed();
    const before = await handle.db.select().from(incidentTypes).orderBy(asc(incidentTypes.code));

    await seed();

    expect(await handle.db.select().from(incidentTypes).orderBy(asc(incidentTypes.code))).toEqual(
      before,
    );
    expect(await incidentTypeRows()).toEqual(EXPECTED_INCIDENT_TYPES);
  });
});

describe('seedDatabase · usuarios demo', () => {
  it('CA-01.12: crea exactamente cuatro usuarios demo activos, uno por rol, del dominio incidapp.test', async () => {
    await seed();

    const rows = await userRows();
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.role).sort()).toEqual(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER']);
    for (const row of rows) {
      expect(row.active).toBe(true);
      expect(row.email).toMatch(/^[a-z]+@incidapp\.test$/);
    }
    expect(rows.map(({ email, name, role }) => ({ email, name, role }))).toEqual(
      [...DEMO_USERS]
        .sort((a, b) => a.email.localeCompare(b.email))
        .map(({ email, name, role }) => ({ email, name, role })),
    );
  });

  it('CA-01.12: asigna a cada usuario demo sus departamentos', async () => {
    await seed();

    expect(await departmentsByEmail()).toEqual(
      Object.fromEntries(DEMO_USERS.map((user) => [user.email, [...user.departmentCodes].sort()])),
    );
  });

  it('CA-01.11: guarda la contraseña demo como hash argon2id que verifica, nunca en claro', async () => {
    await seed();

    const rows = await userRows();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(row.passwordHash).not.toContain(DEMO_PASSWORD);
      expect(await passwordHasher.verify(row.passwordHash, DEMO_PASSWORD)).toBe(true);
    }
  });

  it('CA-01.12: el segundo seed no duplica usuarios, departamentos asignados ni cambia las contraseñas', async () => {
    await seed();
    const before = await userRows();
    const departmentsBefore = await departmentsByEmail();

    await seed();

    expect(await userRows()).toEqual(before);
    expect(await departmentsByEmail()).toEqual(departmentsBefore);
  });

  it('CA-01.12: no cambia la contraseña de un usuario demo que ya existía', async () => {
    await seed();
    await handle.db
      .update(users)
      .set({ passwordHash: '$argon2id$cambiada' })
      .where(eq(users.email, 'admin@incidapp.test'));

    await seed();

    const [admin] = await handle.db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@incidapp.test'));
    expect(admin?.passwordHash).toBe('$argon2id$cambiada');
  });

  it('CA-01.12: se puede iniciar sesión con cada usuario demo y la contraseña documentada', async () => {
    await seed();
    await seed();
    const login = makeLogin({
      users: createDrizzleUserRepository(handle.db),
      sessions: createDrizzleSessionRepository(handle.db),
      auditLog: createDrizzleAuditLogWriter(handle.db),
      passwordHasher,
      sessionTokens: createSessionTokens(),
      clock: systemClock,
    });

    for (const demo of DEMO_USERS) {
      const { user } = await login({ email: demo.email, password: DEMO_PASSWORD, ip: null });
      expect(user).toMatchObject({ email: demo.email, name: demo.name, role: demo.role });
      expect(user.departments.map((department) => department.code).sort()).toEqual(
        [...demo.departmentCodes].sort(),
      );
    }
  });
});

// ── Datos demo (F07) ──────────────────────────────────────────────────────────────────────────

/** Momento fijo del *seed* en los tests: las fechas demo se cuentan hacia atrás desde aquí. */
const SEED_NOW = new Date('2026-11-25T10:00:00.000Z');

/** Los casos de uso reales con el reloj que les pasa el *seed* (como en el composition root). */
const useCasesFor = (db: Database) => (clock: Clock) => {
  const deps = {
    incidentTypes: createDrizzleIncidentTypeRepository(db),
    unitOfWork: createDrizzleUnitOfWork(db),
    clock,
  };
  return {
    createIncident: makeCreateIncident(deps),
    assignIncident: makeAssignIncident(deps),
    changeIncidentStatus: makeChangeIncidentStatus(deps),
  };
};

/**
 * Lo mismo que `npm run db:seed`: catálogos y usuarios demo, usuarios adicionales e incidencias.
 * Devuelve los avisos del *seed* demo.
 */
async function seedAll(db: Database, demoIncidents?: readonly DemoIncident[]): Promise<string[]> {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  await seedDatabase(db, { passwordHasher });
  await seedDemoStaff(db, { passwordHasher, warn });
  await seedDemoIncidents(db, {
    now: SEED_NOW,
    useCasesWith: useCasesFor(db),
    warn,
    ...(demoIncidents ? { incidents: demoIncidents } : {}),
  });
  return warnings;
}

/** Usuario actual (con sus departamentos), por id. */
async function currentUserById(db: Database, id: string): Promise<CurrentUser> {
  const record = await createDrizzleUserRepository(db).findCurrentUser(id);
  if (!record) throw new Error(`No existe el usuario ${id}`);
  return { ...record.user, allowedActions: globalActionsFor(record.user) };
}

/** Usuario actual (con sus departamentos), por email. */
async function currentUserByEmail(db: Database, email: string): Promise<CurrentUser> {
  const account = await createDrizzleUserRepository(db).findAccountByEmail(email);
  if (!account) throw new Error(`No existe ${email}`);
  return currentUserById(db, account.id);
}

/** Todas las incidencias visibles para el actor (una sola página grande). */
async function visibleTo(db: Database, user: CurrentUser): Promise<IncidentRecord[]> {
  const { items } = await createDrizzleIncidentRepository(db).list({
    scope: incidentVisibilityScope(actorOf(user)),
    filters: {},
    page: 1,
    pageSize: 1000,
  });
  return items;
}

async function departmentsByEmailOf(db: Database): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ email: users.email, code: departments.code })
    .from(userDepartments)
    .innerJoin(users, eq(users.id, userDepartments.userId))
    .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
    .orderBy(asc(users.email), asc(departments.code));
  const result: Record<string, string[]> = {};
  for (const { email, code } of rows) (result[email] ??= []).push(code);
  return result;
}

const ALL_STATUSES: Status[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'REOPENED',
];

describe('seedDemoIncidents · contenido', () => {
  let demo: DatabaseHandle;
  let all: IncidentRecord[];
  let warnings: string[];

  beforeAll(async () => {
    demo = await createTestDatabase();
    warnings = await seedAll(demo.db);
    all = await visibleTo(demo.db, await currentUserByEmail(demo.db, 'direccion@incidapp.test'));
  }, 60_000);

  afterAll(async () => {
    await demo.close();
  });

  it('CA-07.2: todos los pasos de los datos demo se cargan sin ningún aviso', () => {
    expect(warnings).toEqual([]);
  });

  it('CA-07.1: Dirección ve entre 25 y 40 incidencias, ≥ 2 de cada tipo, los 7 estados, las 4 prioridades y asignadas y sin asignar', () => {
    expect(all).toHaveLength(DEMO_INCIDENTS.length);
    expect(all.length).toBeGreaterThanOrEqual(25);
    expect(all.length).toBeLessThanOrEqual(40);
    for (const type of INCIDENT_TYPES) {
      expect(
        all.filter((incident) => incident.type.code === type.code).length,
      ).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(all.map((incident) => incident.status))).toEqual(new Set(ALL_STATUSES));
    const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    expect(new Set(all.map((incident) => incident.priority))).toEqual(new Set(priorities));
    expect(all.some((incident) => incident.assignee === null)).toBe(true);
    expect(all.some((incident) => incident.assignee !== null)).toBe(true);
  });

  it('CA-07.1: cada incidencia está en el departamento de su tipo', () => {
    const departmentOfType = new Map<string, string>(
      INCIDENT_TYPES.map((type) => [type.code, type.departmentCode]),
    );
    for (const incident of all) {
      expect(incident.department.code).toBe(departmentOfType.get(incident.type.code));
    }
  });

  it('CA-07.1: el Usuario demo ve las que ha creado, las asignadas a él y las de LOG, y no ve las demás', async () => {
    const usuario = await currentUserByEmail(demo.db, 'usuario@incidapp.test');
    const visibleIds = new Set((await visibleTo(demo.db, usuario)).map((incident) => incident.id));

    const created = all.filter((incident) => incident.createdBy.id === usuario.id);
    expect(created.some((incident) => incident.department.code !== 'LOG')).toBe(true);
    expect(all.some((incident) => incident.assignee?.id === usuario.id)).toBe(true);
    for (const incident of all) {
      const shouldSee =
        incident.department.code === 'LOG' ||
        incident.createdBy.id === usuario.id ||
        incident.assignee?.id === usuario.id;
      expect(visibleIds.has(incident.id), incident.title).toBe(shouldSee);
    }
    expect(visibleIds.size).toBeLessThan(all.length);
  });

  it('CA-07.1: hay una incidencia de LOG en cada estado para probar las transiciones del Responsable demo', () => {
    const logStatuses = all
      .filter((incident) => incident.department.code === 'LOG')
      .map((incident) => incident.status);
    expect(new Set(logStatuses)).toEqual(new Set(ALL_STATUSES));
  });

  it('CA-07.2: el historial empieza por CREATED, cada paso lo permiten la máquina de estados y la política, y acaba en el estado actual', async () => {
    const reader = createDrizzleIncidentEventReader(demo.db);
    const actors = new Map<string, CurrentUser>();
    const userById = async (id: string): Promise<CurrentUser> => {
      const user = actors.get(id) ?? (await currentUserById(demo.db, id));
      actors.set(id, user);
      return user;
    };

    for (const incident of all) {
      const events = await reader.listByIncident(incident.id);
      expect(events[0]?.type, incident.title).toBe('CREATED');
      expect(events[0]?.actor.id).toBe(incident.createdBy.id);
      expect(events[0]?.createdAt).toEqual(incident.createdAt);

      let status: Status = 'OPEN';
      let assignedToId: string | null = null;
      let lastResolved: Date | null = null;
      let lastClosed: Date | null = null;
      for (const [index, event] of events.entries()) {
        const previous = events[index - 1];
        if (previous) {
          expect(event.createdAt.getTime()).toBeGreaterThan(previous.createdAt.getTime());
        }
        expect(event.createdAt.getTime()).toBeLessThan(SEED_NOW.getTime());
        expect(event.type, incident.title).not.toBe('UPDATED');

        const actor = actorOf(await userById(event.actor.id));
        const facts = {
          ownerDepartmentId: incident.department.id,
          createdById: incident.createdBy.id,
          assignedToId,
          status,
        };
        if (event.type === 'ASSIGNED') {
          expect(canOnIncident(actor, facts, 'assign'), incident.title).toBe(true);
          const assignee = await userById(event.data.to.id);
          expect(assignee.departments.map((department) => department.id)).toContain(
            incident.department.id,
          );
          assignedToId = event.data.to.id;
        }
        if (event.type === 'STATUS_CHANGED') {
          expect(event.data.from, incident.title).toBe(status);
          const transition = findTransition(status, event.data.to);
          expect(canOnIncident(actor, facts, transitionActionOf(transition)), incident.title).toBe(
            true,
          );
          if (transition.requiresComment) expect(event.data.comment, incident.title).toBeTruthy();
          status = transition.to;
          if (status === 'RESOLVED') lastResolved = event.createdAt;
          if (status === 'CLOSED') lastClosed = event.createdAt;
        }
      }
      expect(status, incident.title).toBe(incident.status);
      expect(incident.assignee?.id ?? null).toBe(assignedToId);
      expect(incident.resolvedAt).toEqual(lastResolved);
      expect(incident.closedAt).toEqual(lastClosed);
    }
  });

  it('CA-07.2: las altas son de las últimas 4 semanas y los códigos siguen su orden', () => {
    const fourWeeksMs = 28 * 24 * 60 * 60 * 1000;
    for (const incident of all) {
      expect(incident.createdAt.getTime()).toBeGreaterThan(SEED_NOW.getTime() - fourWeeksMs);
      expect(incident.code).toMatch(/^INC-2026-\d{4}$/);
    }
    const byDate = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(byDate.map((incident) => incident.code)).toEqual(
      all.map((incident) => incident.code).sort(),
    );
  });

  it('CA-07.3: no pasa de 40 incidencias ni de 200 eventos', async () => {
    const [events] = await demo.db.select({ total: count() }).from(incidentEvents);
    expect(all.length).toBeLessThanOrEqual(40);
    expect(events?.total).toBeLessThanOrEqual(200);
  });

  it('CA-07.4: los usuarios adicionales son ficticios (.test), con sus departamentos, y no entran con la contraseña demo', async () => {
    const rows = await demo.db
      .select()
      .from(users)
      .where(
        inArray(
          users.email,
          DEMO_STAFF.map((user) => user.email),
        ),
      );
    expect(rows).toHaveLength(DEMO_STAFF.length);
    for (const row of rows) {
      expect(row.active).toBe(true);
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await passwordHasher.verify(row.passwordHash, DEMO_PASSWORD)).toBe(false);
    }
    for (const row of await demo.db.select({ email: users.email }).from(users)) {
      expect(row.email).toMatch(/@incidapp\.test$/);
    }
    expect(await departmentsByEmailOf(demo.db)).toMatchObject(
      Object.fromEntries(DEMO_STAFF.map((user) => [user.email, [...user.departmentCodes]])),
    );
  });
});

/** Foto de todo lo que carga el *seed*, para comparar antes y después. */
async function snapshot(db: Database) {
  return {
    incidents: await db.select().from(incidents).orderBy(asc(incidents.code)),
    events: await db.select().from(incidentEvents).orderBy(asc(incidentEvents.id)),
    counters: await db.select().from(codeCounters).orderBy(asc(codeCounters.year)),
    users: await db.select().from(users).orderBy(asc(users.email)),
    memberships: await departmentsByEmailOf(db),
  };
}

/** Crea a mano (como en la demo) una incidencia de Transporte del Usuario demo. */
async function createManualIncident(db: Database): Promise<string> {
  const usuario = await currentUserByEmail(db, 'usuario@incidapp.test');
  const [transport] = await db
    .select({ id: incidentTypes.id })
    .from(incidentTypes)
    .where(eq(incidentTypes.code, 'TRANSPORT'));
  const manual = await useCasesFor(db)({
    now: () => new Date('2026-11-20T09:00:00.000Z'),
  }).createIncident({
    actor: usuario,
    input: {
      title: 'Incidencia creada a mano antes del seed',
      description: 'Prueba manual.',
      typeId: transport?.id ?? '',
      priority: 'LOW',
    },
  });
  return manual.id;
}

describe('seedDemoIncidents · una sola vez por base de datos', () => {
  it('CA-07.3: ejecutarlo dos veces no duplica ni modifica nada', async () => {
    await seedAll(handle.db);
    const before = await snapshot(handle.db);

    expect(await seedAll(handle.db)).toEqual([]);

    expect(before.incidents).toHaveLength(DEMO_INCIDENTS.length);
    expect(await snapshot(handle.db)).toEqual(before);
  }, 60_000);

  it('CA-07.3: sobre una base con incidencias previas no carga nada (ni incidencias ni usuarios adicionales)', async () => {
    await seedDatabase(handle.db, { passwordHasher });
    await createManualIncident(handle.db);
    const before = await snapshot(handle.db);

    expect(await seedAll(handle.db)).toEqual([]);

    expect(await snapshot(handle.db)).toEqual(before);
    expect(before.incidents).toHaveLength(1);
    expect(before.users.map((user) => user.email)).toEqual(
      DEMO_USERS.map((user) => user.email).sort(),
    );
  }, 60_000);

  it('CA-07.3: una vez cargados, no se recargan aunque cambien títulos, emails o se desactiven usuarios', async () => {
    await seedAll(handle.db);
    // En la demo, el Admin cambia títulos y estados, cambia el email de un usuario adicional y
    // desactiva a otro (sin pasar por el *seed*).
    await handle.db
      .update(incidents)
      .set({ title: 'Título cambiado en la demo', priority: 'URGENT', status: 'IN_PROGRESS' });
    const [renamed, deactivated] = DEMO_STAFF;
    if (!renamed || !deactivated) throw new Error('Faltan usuarios adicionales');
    await handle.db
      .update(users)
      .set({ email: 'cambiado@incidapp.test' })
      .where(eq(users.email, renamed.email));
    await handle.db.update(users).set({ active: false }).where(eq(users.email, deactivated.email));
    const before = await snapshot(handle.db);

    expect(await seedAll(handle.db)).toEqual([]);

    expect(await snapshot(handle.db)).toEqual(before);
  }, 60_000);

  it('CA-07.3: no cambia un usuario adicional que ya existe (contraseña ni departamentos)', async () => {
    const warn = () => {
      throw new Error('No debería avisar');
    };
    await seedDatabase(handle.db, { passwordHasher });
    await seedDemoStaff(handle.db, { passwordHasher, warn });
    const [staff] = DEMO_STAFF;
    if (!staff) throw new Error('Sin usuarios adicionales');
    const [account] = await handle.db.select().from(users).where(eq(users.email, staff.email));
    // El Admin le quita sus departamentos desde la gestión de usuarios.
    await handle.db.delete(userDepartments).where(eq(userDepartments.userId, account?.id ?? ''));
    const before = await snapshot(handle.db);

    await seedDemoStaff(handle.db, { passwordHasher, warn });

    expect(await snapshot(handle.db)).toEqual(before);
  }, 60_000);

  it('CA-07.3: si la política no permite un paso, avisa en español nombrando la incidencia y el paso, sigue con las demás y no lanza', async () => {
    const usuario = 'usuario@incidapp.test';
    const invalid: DemoIncident = {
      title: 'Incidencia demo con un paso no permitido',
      description: 'El Usuario demo no puede cerrar incidencias.',
      typeCode: 'TRANSPORT',
      priority: 'LOW',
      createdBy: usuario,
      createdAt: [3, '09:00'],
      steps: [
        { action: 'transition', at: [3, '10:00'], actor: usuario, to: 'IN_PROGRESS' },
        {
          action: 'transition',
          at: [3, '11:00'],
          actor: usuario,
          to: 'RESOLVED',
          comment: 'Hecho.',
        },
        { action: 'transition', at: [3, '12:00'], actor: usuario, to: 'CLOSED' },
      ],
    };
    const valid = DEMO_INCIDENTS.find((incident) => incident.createdAt[0] < 3);
    if (!valid) throw new Error('Sin una incidencia demo posterior');

    const warnings = await seedAll(handle.db, [invalid, valid]);

    expect(warnings).toEqual([
      expect.stringMatching(
        /^Aviso: la incidencia demo "Incidencia demo con un paso no permitido" no se ha cargado completa \(falla en el paso 3\): /,
      ),
    ]);
    const titles = (await handle.db.select({ title: incidents.title }).from(incidents)).map(
      (row) => row.title,
    );
    expect(titles.sort()).toEqual([invalid.title, valid.title].sort());
  }, 60_000);
});
