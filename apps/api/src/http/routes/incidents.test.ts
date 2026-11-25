// Tests de punta a punta de `/api/incidents` con `fastify.inject`: casos de uso, repositorios
// Drizzle sobre PGlite en memoria con el *seed* real y reloj fijo (CA-03.2 a CA-03.10, CA-04.2 a
// CA-04.6). La matriz completa rol × endpoint × relación es de T-03.05 y T-04.05.
import {
  DEMO_USERS,
  ErrorResponse,
  Incident,
  IncidentEventList,
  IncidentListResponse,
  UserSummary,
  type Role,
} from '@incidapp/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import { makeLogout } from '../../application/auth/logout';
import { makeResolveSession } from '../../application/auth/resolve-session';
import { FakePasswordHasher, FixedClock } from '../../application/auth/test-fakes';
import { makeAssignIncident } from '../../application/incidents/assign-incident';
import { makeChangeIncidentStatus } from '../../application/incidents/change-incident-status';
import { makeCreateIncident } from '../../application/incidents/create-incident';
import { makeGetIncident } from '../../application/incidents/get-incident';
import { makeListAssignees } from '../../application/incidents/list-assignees';
import { makeListIncidentEvents } from '../../application/incidents/list-incident-events';
import { makeListIncidentTypes } from '../../application/incidents/list-incident-types';
import { makeListIncidents } from '../../application/incidents/list-incidents';
import { makeUpdateIncident } from '../../application/incidents/update-incident';
import { createSessionTokens } from '../../infrastructure/auth/session-tokens';
import type { DatabaseHandle } from '../../infrastructure/db/client';
import { createDrizzleAuditLogWriter } from '../../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleIncidentEventReader } from '../../infrastructure/db/repositories/incident-event-reader';
import { createDrizzleIncidentRepository } from '../../infrastructure/db/repositories/incident-repository';
import { createDrizzleIncidentTypeRepository } from '../../infrastructure/db/repositories/incident-type-repository';
import { createDrizzleSessionRepository } from '../../infrastructure/db/repositories/session-repository';
import { createDrizzleUserAdminRepository } from '../../infrastructure/db/repositories/user-admin-repository';
import { createDrizzleUserRepository } from '../../infrastructure/db/repositories/user-repository';
import {
  codeCounters,
  incidentEvents,
  incidents,
  incidentTypes,
  users,
} from '../../infrastructure/db/schema';
import { seedDatabase } from '../../infrastructure/db/seed';
import { createTestDatabase } from '../../infrastructure/db/test-database';
import { createDrizzleUnitOfWork } from '../../infrastructure/db/unit-of-work';
import { buildApp } from '../app';
import { createAuthzClient, unusedAdmin, type AuthzClient } from '../test-support';

const T0 = new Date('2026-11-25T10:00:00.000Z');
const MISSING_ID = '00000000-0000-4000-8000-00000000ffff';
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' } };

let database: DatabaseHandle;
let app: FastifyInstance;
let api: AuthzClient;
let typeId: Record<string, string>;
let userId: Record<Role, string>;
/** Reloj de toda la app: vuelve a T0 antes de cada test; los de F04 lo adelantan entre pasos. */
let clock: FixedClock;

beforeAll(async () => {
  database = await createTestDatabase();
  const passwordHasher = new FakePasswordHasher();
  await seedDatabase(database.db, { passwordHasher });
  clock = new FixedClock(T0);
  const authDeps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher,
    sessionTokens: createSessionTokens(),
    clock,
  };
  const incidentDeps = {
    incidents: createDrizzleIncidentRepository(database.db),
    incidentTypes: createDrizzleIncidentTypeRepository(database.db),
    incidentEvents: createDrizzleIncidentEventReader(database.db),
    users: createDrizzleUserAdminRepository(database.db),
    unitOfWork: createDrizzleUnitOfWork(database.db),
    clock,
  };
  app = await buildApp({
    getHealth: async () => ({ status: 'ok', db: 'ok', version: '0.1.0' }),
    auth: {
      login: makeLogin(authDeps),
      logout: makeLogout(authDeps),
      resolveSession: makeResolveSession(authDeps),
      loginRateLimit: { max: 1000, timeWindowMs: 60_000 },
    },
    ...unusedAdmin,
    incidentTypes: { listIncidentTypes: makeListIncidentTypes(incidentDeps) },
    incidents: {
      listIncidents: makeListIncidents(incidentDeps),
      getIncident: makeGetIncident(incidentDeps),
      createIncident: makeCreateIncident(incidentDeps),
      updateIncident: makeUpdateIncident(incidentDeps),
      listAssignees: makeListAssignees(incidentDeps),
      assignIncident: makeAssignIncident(incidentDeps),
      changeIncidentStatus: makeChangeIncidentStatus(incidentDeps),
      listIncidentEvents: makeListIncidentEvents(incidentDeps),
    },
    enforceHttps: false,
    logger: false,
  });
  api = await createAuthzClient(app);
  typeId = Object.fromEntries(
    (await database.db.select().from(incidentTypes)).map((t) => [t.code, t.id]),
  );
  const rows = await database.db.select().from(users);
  userId = Object.fromEntries(
    DEMO_USERS.map((demo) => [demo.role, rows.find((r) => r.email === demo.email)!.id]),
  ) as Record<Role, string>;
});

afterAll(async () => {
  await app.close();
  await database.close();
});

beforeEach(async () => {
  clock.current = T0;
  await database.db.delete(incidentEvents);
  await database.db.delete(incidents);
  await database.db.delete(codeCounters);
});

// --- Ayudas -------------------------------------------------------------------------------------

const VALID = () => ({
  title: '  Retraso en la entrega  ',
  description: 'El transportista no ha llegado a la hora acordada.',
  typeId: typeId.TRANSPORT,
  priority: 'HIGH',
  dueDate: '2026-12-01',
});

/** Crea una incidencia por la API como `role` y la devuelve. */
async function createAs(role: Role, body: Record<string, unknown> = {}): Promise<Incident> {
  const response = await api.call('POST', '/api/incidents', {
    token: api.tokens[role],
    payload: { ...VALID(), ...body },
  });
  expect(response.statusCode).toBe(201);
  return Incident.parse(response.json());
}

const eventRows = () =>
  database.db.select().from(incidentEvents).orderBy(asc(incidentEvents.createdAt));

const errorOf = (response: { json(): unknown }) => ErrorResponse.parse(response.json()).error;

// --- CA-03.2 a CA-03.5: alta --------------------------------------------------------------------

describe('POST /api/incidents', () => {
  it('CA-03.2: crea la incidencia (201) con código, ABIERTA, dpto. del tipo, creador y acciones', async () => {
    const response = await api.call('POST', '/api/incidents', {
      token: api.tokens.USER,
      payload: VALID(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const incident = Incident.parse(response.json());
    expect(incident).toMatchObject({
      code: 'INC-2026-0001',
      title: 'Retraso en la entrega',
      type: { code: 'TRANSPORT', name: 'Transporte' },
      department: { code: 'LOG' },
      priority: 'HIGH',
      status: 'OPEN',
      createdBy: { id: userId.USER, name: 'Pablo Moreno' },
      assignee: null,
      dueDate: '2026-12-01',
      createdAt: T0.toISOString(),
      allowedActions: ['update'],
      allowedTransitions: [{ to: 'IN_PROGRESS', requiresComment: false }],
    });
    expect(await eventRows()).toMatchObject([
      { incidentId: incident.id, type: 'CREATED', actorId: userId.USER, data: {}, createdAt: T0 },
    ]);
  });

  it('CA-03.2: ignora los campos que decide el servidor', async () => {
    const incident = await createAs('USER', {
      code: 'INC-1999-9999',
      status: 'CLOSED',
      departmentId: MISSING_ID,
      createdBy: userId.ADMIN,
      assignedTo: userId.MANAGER,
      createdAt: '2020-01-01T00:00:00.000Z',
      resolvedAt: '2020-01-01T00:00:00.000Z',
      closedAt: '2020-01-01T00:00:00.000Z',
    });

    expect(incident).toMatchObject({
      code: 'INC-2026-0001',
      status: 'OPEN',
      department: { code: 'LOG' },
      createdBy: { id: userId.USER },
      assignee: null,
      createdAt: T0.toISOString(),
      resolvedAt: null,
      closedAt: null,
    });
  });

  it.each([
    ['título vacío', { title: '   ' }, 'title'],
    ['título de 151 caracteres', { title: 'a'.repeat(151) }, 'title'],
    ['descripción vacía', { description: '' }, 'description'],
    ['descripción de 5001 caracteres', { description: 'a'.repeat(5001) }, 'description'],
    ['prioridad inexistente', { priority: 'CRITICAL' }, 'priority'],
    ['fecha objetivo no AAAA-MM-DD', { dueDate: '01/12/2026' }, 'dueDate'],
    ['tipo inexistente', { typeId: MISSING_ID }, 'typeId'],
    ['tipo que no es un UUID', { typeId: 'transporte' }, 'typeId'],
  ])('CA-03.3: %s → 400 en español y no crea nada', async (_case, body, path) => {
    const response = await api.call('POST', '/api/incidents', {
      token: api.tokens.MANAGER,
      payload: { ...VALID(), ...body },
    });

    expect(response.statusCode).toBe(400);
    const error = errorOf(response);
    expect(error.code).toBe('VALIDATION');
    expect(error.details?.find((d) => d.path === path)?.message).toMatch(/^[A-ZÁÉÍÓÚÑ¿¡]/);
    expect(await database.db.select().from(incidents)).toEqual([]);
    expect(await database.db.select().from(codeCounters)).toEqual([]);
    expect(await eventRows()).toEqual([]);
  });

  it('CA-03.3: el mensaje del tipo inexistente', async () => {
    const response = await api.call('POST', '/api/incidents', {
      token: api.tokens.USER,
      payload: { ...VALID(), typeId: MISSING_ID },
    });

    expect(errorOf(response).details).toEqual([
      { path: 'typeId', message: 'El tipo de incidencia no existe.' },
    ]);
  });

  it('CA-03.4: los códigos son correlativos y, tras un alta fallida, no hay hueco', async () => {
    const first = await createAs('USER');
    await api.call('POST', '/api/incidents', {
      token: api.tokens.USER,
      payload: { ...VALID(), typeId: MISSING_ID },
    });
    const second = await createAs('ADMIN', { typeId: typeId.QUALITY });

    expect([first.code, second.code]).toEqual(['INC-2026-0001', 'INC-2026-0002']);
  });

  it('CA-03.4: altas simultáneas obtienen códigos distintos y sin huecos', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        api.call('POST', '/api/incidents', { token: api.tokens.USER, payload: VALID() }),
      ),
    );

    expect(responses.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
    expect(responses.map((r) => Incident.parse(r.json()).code).sort()).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `INC-2026-000${n}`),
    );
  });

  it('CA-03.5: Dirección recibe 403 (antes que la validación del cuerpo) y no se crea nada', async () => {
    for (const payload of [VALID(), { title: '' }]) {
      const response = await api.call('POST', '/api/incidents', {
        token: api.tokens.DIRECTOR,
        payload,
      });
      expect(response.statusCode).toBe(403);
      expect(errorOf(response).code).toBe('FORBIDDEN');
    }
    expect(await database.db.select().from(incidents)).toEqual([]);
  });
});

// --- CA-03.6: detalle ---------------------------------------------------------------------------

describe('GET /api/incidents/:id', () => {
  it('CA-03.6: devuelve el detalle con las acciones de cada actor', async () => {
    const created = await createAs('USER');

    const expected: Record<Role, string[]> = {
      ADMIN: ['update', 'assign'],
      DIRECTOR: [],
      MANAGER: ['update', 'assign'],
      USER: ['update'],
    };
    for (const role of Object.keys(expected) as Role[]) {
      const response = await api.call('GET', `/api/incidents/${created.id}`, {
        token: api.tokens[role],
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const incident = Incident.parse(response.json());
      expect(incident).toMatchObject({
        id: created.id,
        description: created.description,
        createdBy: { id: userId.USER, name: 'Pablo Moreno' },
        updatedAt: T0.toISOString(),
        allowedActions: expected[role],
      });
    }
  });

  it('CA-03.6: 404 con el mismo cuerpo si no existe, no es un UUID o no es visible', async () => {
    const foreign = await createAs('ADMIN', { typeId: typeId.QUALITY });

    for (const [role, id] of [
      ['ADMIN', MISSING_ID],
      ['ADMIN', 'no-es-un-uuid'],
      ['USER', foreign.id],
      ['MANAGER', foreign.id],
    ] as const) {
      const response = await api.call('GET', `/api/incidents/${id}`, { token: api.tokens[role] });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });
});

// --- CA-03.7 · CA-03.8: listado -----------------------------------------------------------------

describe('GET /api/incidents', () => {
  it('CA-03.7: cada rol recibe solo las visibles, de la más reciente a la más antigua', async () => {
    const log = await createAs('ADMIN', { typeId: typeId.TRANSPORT });
    const cal = await createAs('ADMIN', { typeId: typeId.QUALITY });
    const calByUser = await createAs('USER', { typeId: typeId.QUALITY });
    // Con el reloj fijo empatan en `createdAt`: el desempate es el id, descendente.
    const all = [log, cal, calByUser].sort((a, b) => b.id.localeCompare(a.id)).map((i) => i.id);

    const expected: Record<Role, string[]> = {
      ADMIN: all,
      DIRECTOR: all,
      MANAGER: all.filter((id) => id !== cal.id && id !== calByUser.id),
      USER: all.filter((id) => id !== cal.id),
    };
    for (const role of Object.keys(expected) as Role[]) {
      const response = await api.call('GET', '/api/incidents', { token: api.tokens[role] });
      expect(response.statusCode).toBe(200);
      const list = IncidentListResponse.parse(response.json());
      expect(list.items.map((i) => i.id)).toEqual(expected[role]);
      expect(list).toMatchObject({ total: expected[role].length, page: 1, pageSize: 20 });
    }
  });

  it('CA-03.7: pagina de 20 en 20', async () => {
    for (let i = 0; i < 21; i += 1) await createAs('USER');

    const first = IncidentListResponse.parse(
      (await api.call('GET', '/api/incidents', { token: api.tokens.USER })).json(),
    );
    const second = IncidentListResponse.parse(
      (await api.call('GET', '/api/incidents?page=2', { token: api.tokens.USER })).json(),
    );

    expect([first.items.length, second.items.length]).toEqual([20, 1]);
    expect([first.total, second.total, second.page]).toEqual([21, 21, 2]);
  });

  it('CA-03.8: los filtros se combinan con Y y no amplían lo visible', async () => {
    const urgent = await createAs('USER', { priority: 'URGENT', title: 'Camión averiado' });
    await createAs('USER', { priority: 'LOW' });
    const cal = await createAs('ADMIN', { typeId: typeId.QUALITY, priority: 'URGENT' });
    const assigned = await createAs('MANAGER', { priority: 'LOW' });
    await api.call('POST', `/api/incidents/${assigned.id}/assign`, {
      token: api.tokens.MANAGER,
      payload: { assigneeId: userId.USER },
    });
    const calDepartment = cal.department.id;
    const ids = async (role: Role, qs: string) =>
      IncidentListResponse.parse(
        (await api.call('GET', `/api/incidents?${qs}`, { token: api.tokens[role] })).json(),
      ).items.map((i) => i.id);

    expect(await ids('ADMIN', 'priority=URGENT')).toEqual(
      [urgent.id, cal.id].sort((a, b) => b.localeCompare(a)),
    );
    expect(await ids('ADMIN', `priority=URGENT&departmentId=${calDepartment}`)).toEqual([cal.id]);
    expect(await ids('ADMIN', 'status=OPEN&q=camión')).toEqual([urgent.id]);
    expect(await ids('ADMIN', `q=${urgent.code.toLowerCase()}`)).toEqual([urgent.id]);
    expect(await ids('USER', 'assignedToMe=true')).toEqual([assigned.id]);
    expect(await ids('MANAGER', 'assignedToMe=true')).toEqual([]);
    expect(await ids('MANAGER', `departmentId=${calDepartment}`)).toEqual([]);
    expect(await ids('ADMIN', 'status=CLOSED')).toEqual([]);
  });

  it.each(['status=ABIERTA', 'priority=CRITICAL', 'page=0', 'page=', 'departmentId=LOG'])(
    'CA-03.8: un filtro no válido (%s) responde 400',
    async (qs) => {
      const response = await api.call('GET', `/api/incidents?${qs}`, { token: api.tokens.ADMIN });

      expect(response.statusCode).toBe(400);
      expect(errorOf(response).code).toBe('VALIDATION');
    },
  );
});

// --- CA-03.9: edición ---------------------------------------------------------------------------

describe('PATCH /api/incidents/:id', () => {
  it('CA-03.9: el creador edita su incidencia ABIERTA y se registra UPDATED con antes y después', async () => {
    const created = await createAs('USER');

    const response = await api.call('PATCH', `/api/incidents/${created.id}`, {
      token: api.tokens.USER,
      payload: { title: 'Retraso grave', priority: 'HIGH', dueDate: null, status: 'CLOSED' },
    });

    expect(response.statusCode).toBe(200);
    expect(Incident.parse(response.json())).toMatchObject({
      title: 'Retraso grave',
      priority: 'HIGH',
      dueDate: null,
      status: 'OPEN',
    });
    const [, updated] = await eventRows();
    expect(updated).toMatchObject({
      type: 'UPDATED',
      actorId: userId.USER,
      data: {
        changes: [
          { field: 'title', before: 'Retraso en la entrega', after: 'Retraso grave' },
          { field: 'dueDate', before: '2026-12-01', after: null },
        ],
      },
    });
  });

  it('CA-03.9: si nada cambia, 200 sin evento', async () => {
    const created = await createAs('USER');

    const response = await api.call('PATCH', `/api/incidents/${created.id}`, {
      token: api.tokens.ADMIN,
      payload: { title: created.title, typeId: typeId.QUALITY },
    });

    expect(response.statusCode).toBe(200);
    expect(Incident.parse(response.json()).type.code).toBe('TRANSPORT');
    expect((await eventRows()).map((e) => e.type)).toEqual(['CREATED']);
  });

  it('CA-03.9: 403 para Dirección, para el Usuario que no la creó y fuera de ABIERTA', async () => {
    const byManager = await createAs('MANAGER');
    const byUser = await createAs('USER');
    await database.db
      .update(incidents)
      .set({ status: 'IN_PROGRESS' })
      .where(eq(incidents.id, byUser.id));

    for (const [role, id] of [
      ['DIRECTOR', byUser.id],
      ['USER', byManager.id],
      ['USER', byUser.id],
    ] as const) {
      const response = await api.call('PATCH', `/api/incidents/${id}`, {
        token: api.tokens[role],
        payload: { title: 'Cambio' },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('CA-03.9: 404 si no es visible; 400 si el cuerpo no es válido o está vacío', async () => {
    const foreign = await createAs('ADMIN', { typeId: typeId.QUALITY });
    const own = await createAs('USER');

    const hidden = await api.call('PATCH', `/api/incidents/${foreign.id}`, {
      token: api.tokens.USER,
      payload: { title: 'Cambio' },
    });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toEqual(NOT_FOUND);

    for (const payload of [{}, { status: 'CLOSED' }, { title: '' }, { dueDate: '2026-13-40' }]) {
      const response = await api.call('PATCH', `/api/incidents/${own.id}`, {
        token: api.tokens.USER,
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });
});

// --- CA-03.10: asignación -----------------------------------------------------------------------

describe('asignación', () => {
  it('CA-03.10: el Responsable ve los candidatos activos del dpto. y asigna; se registra ASSIGNED', async () => {
    const created = await createAs('USER');

    const candidates = await api.call('GET', `/api/incidents/${created.id}/assignees`, {
      token: api.tokens.MANAGER,
    });
    expect(candidates.statusCode).toBe(200);
    expect(candidates.headers['cache-control']).toBe('no-store');
    expect(z.array(UserSummary).parse(candidates.json())).toEqual([
      { id: userId.MANAGER, name: 'Carmen Vidal' },
      { id: userId.USER, name: 'Pablo Moreno' },
    ]);

    const response = await api.call('POST', `/api/incidents/${created.id}/assign`, {
      token: api.tokens.MANAGER,
      payload: { assigneeId: userId.USER },
    });
    expect(response.statusCode).toBe(200);
    expect(Incident.parse(response.json()).assignee).toEqual({
      id: userId.USER,
      name: 'Pablo Moreno',
    });
    expect((await eventRows()).at(-1)).toMatchObject({
      type: 'ASSIGNED',
      actorId: userId.MANAGER,
      data: { from: null, to: { id: userId.USER, name: 'Pablo Moreno' } },
    });

    const again = await api.call('POST', `/api/incidents/${created.id}/assign`, {
      token: api.tokens.MANAGER,
      payload: { assigneeId: userId.USER },
    });
    expect(again.statusCode).toBe(200);
    expect((await eventRows()).map((e) => e.type)).toEqual(['CREATED', 'ASSIGNED']);
  });

  it('CA-03.10: un asignado que no es activo del dpto. propietario es 400 con mensaje en español', async () => {
    const created = await createAs('USER');

    for (const assigneeId of [userId.ADMIN, MISSING_ID]) {
      const response = await api.call('POST', `/api/incidents/${created.id}/assign`, {
        token: api.tokens.ADMIN,
        payload: { assigneeId },
      });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toMatchObject({
        code: 'VALIDATION',
        message: 'El usuario no pertenece al departamento de la incidencia o está desactivado.',
      });
    }
    expect((await eventRows()).map((e) => e.type)).toEqual(['CREATED']);
  });

  it('CA-03.10: sin permiso de asignar, 403 en ambos endpoints; si no es visible, 404', async () => {
    const created = await createAs('USER');
    const foreign = await createAs('ADMIN', { typeId: typeId.QUALITY });

    for (const role of ['USER', 'DIRECTOR'] as const) {
      const list = await api.call('GET', `/api/incidents/${created.id}/assignees`, {
        token: api.tokens[role],
      });
      const assign = await api.call('POST', `/api/incidents/${created.id}/assign`, {
        token: api.tokens[role],
        payload: { assigneeId: userId.USER },
      });
      expect([list.statusCode, assign.statusCode]).toEqual([403, 403]);
    }
    const hidden = await api.call('GET', `/api/incidents/${foreign.id}/assignees`, {
      token: api.tokens.MANAGER,
    });
    expect(hidden.statusCode).toBe(404);
  });
});

// --- CA-04.2 · CA-04.3: cambio de estado --------------------------------------------------------

/** `POST …/transitions` como `role`. */
const transition = (role: Role, id: string, payload: Record<string, unknown>) =>
  api.call('POST', `/api/incidents/${id}/transitions`, { token: api.tokens[role], payload });

/** Avanza la incidencia por las transiciones indicadas como Admin, un minuto después cada una. */
async function moveTo(id: string, path: { to: string; comment?: string }[]) {
  for (const step of path) {
    clock.advance(60_000);
    expect((await transition('ADMIN', id, step)).statusCode).toBe(200);
  }
}

describe('POST /api/incidents/:id/transitions', () => {
  it('CA-04.2: el creador empieza su incidencia: 200 con estado, fechas y acciones recalculadas y un STATUS_CHANGED', async () => {
    const created = await createAs('USER');
    clock.advance(60_000);

    const response = await transition('USER', created.id, { to: 'IN_PROGRESS', status: 'CLOSED' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Incident.parse(response.json())).toMatchObject({
      status: 'IN_PROGRESS',
      updatedAt: clock.now().toISOString(),
      resolvedAt: null,
      closedAt: null,
      allowedActions: [],
      allowedTransitions: [
        { to: 'PENDING_THIRD_PARTY', requiresComment: false },
        { to: 'RESOLVED', requiresComment: true },
      ],
    });
    const [, changed] = await eventRows();
    expect(changed).toMatchObject({
      incidentId: created.id,
      type: 'STATUS_CHANGED',
      actorId: userId.USER,
      data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
      createdAt: clock.now(),
    });
  });

  it('CA-04.2 · CA-04.4: resolver con comentario guarda resolvedAt; el Responsable cierra (closedAt) y reabre; Dirección no recibe transiciones', async () => {
    const created = await createAs('USER');
    await moveTo(created.id, [{ to: 'IN_PROGRESS' }]);

    clock.advance(60_000);
    const resolved = await transition('USER', created.id, {
      to: 'RESOLVED',
      comment: '  Entregado con retraso.  ',
    });
    const resolvedAt = clock.now().toISOString();
    expect(resolved.statusCode).toBe(200);
    expect(Incident.parse(resolved.json())).toMatchObject({
      status: 'RESOLVED',
      resolvedAt,
      allowedTransitions: [],
    });

    clock.advance(60_000);
    const closed = await transition('MANAGER', created.id, { to: 'CLOSED' });
    expect(Incident.parse(closed.json())).toMatchObject({
      status: 'CLOSED',
      resolvedAt,
      closedAt: clock.now().toISOString(),
      allowedTransitions: [{ to: 'REOPENED', requiresComment: true }],
    });

    const detail = await api.call('GET', `/api/incidents/${created.id}`, {
      token: api.tokens.DIRECTOR,
    });
    expect(Incident.parse(detail.json()).allowedTransitions).toEqual([]);

    clock.advance(60_000);
    const reopened = await transition('MANAGER', created.id, {
      to: 'REOPENED',
      comment: 'El cliente dice que falta un bulto.',
    });
    expect(Incident.parse(reopened.json())).toMatchObject({ status: 'REOPENED', resolvedAt });
    const changes = (await eventRows()).filter((e) => e.type === 'STATUS_CHANGED');
    expect(changes.map((e) => e.data)).toEqual([
      { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
      { from: 'IN_PROGRESS', to: 'RESOLVED', comment: 'Entregado con retraso.' },
      { from: 'RESOLVED', to: 'CLOSED', comment: null },
      { from: 'CLOSED', to: 'REOPENED', comment: 'El cliente dice que falta un bulto.' },
    ]);
  });

  it('CA-04.3: 404 si no existe, no es un UUID o no es visible (antes que el 409)', async () => {
    const foreign = await createAs('ADMIN', { typeId: typeId.QUALITY });
    await moveTo(foreign.id, [{ to: 'REJECTED', comment: 'No procede.' }]);

    for (const [role, id] of [
      ['ADMIN', MISSING_ID],
      ['ADMIN', 'no-es-un-uuid'],
      ['USER', foreign.id],
      ['MANAGER', foreign.id],
    ] as const) {
      const response = await transition(role, id, { to: 'IN_PROGRESS' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });

  it('CA-04.3: 409 en español si la transición no existe desde el estado actual (también para Dirección)', async () => {
    const created = await createAs('USER');
    await moveTo(created.id, [{ to: 'REJECTED', comment: 'Duplicada.' }]);

    for (const role of ['ADMIN', 'DIRECTOR'] as const) {
      const response = await transition(role, created.id, { to: 'IN_PROGRESS' });
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toEqual({
        code: 'CONFLICT',
        message: 'No se puede pasar de Rechazada a En curso.',
      });
    }
  });

  it('CA-04.3: 403 si el actor no puede hacer su tipo (antes que el 400 del comentario)', async () => {
    const created = await createAs('USER');

    for (const [role, to] of [
      ['DIRECTOR', 'IN_PROGRESS'],
      ['DIRECTOR', 'REJECTED'],
      ['USER', 'REJECTED'],
    ] as const) {
      const response = await transition(role, created.id, { to });
      expect(response.statusCode).toBe(403);
      expect(errorOf(response).code).toBe('FORBIDDEN');
    }
    expect((await eventRows()).map((e) => e.type)).toEqual(['CREATED']);
  });

  it('CA-04.3: 400 si falta el comentario obligatorio (o solo tiene espacios) y nada cambia', async () => {
    const created = await createAs('USER');

    for (const payload of [{ to: 'REJECTED' }, { to: 'REJECTED', comment: '   ' }]) {
      const response = await transition('MANAGER', created.id, payload);
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toEqual({
        code: 'VALIDATION',
        message: 'Esta transición requiere un comentario.',
        details: [{ path: 'comment', message: 'Esta transición requiere un comentario.' }],
      });
    }
    const detail = await api.call('GET', `/api/incidents/${created.id}`, {
      token: api.tokens.MANAGER,
    });
    expect(Incident.parse(detail.json()).status).toBe('OPEN');
    expect((await eventRows()).map((e) => e.type)).toEqual(['CREATED']);
  });

  it.each([
    ['un `to` que no es de Status', { to: 'ABIERTA' }],
    ['sin `to`', {}],
    ['un comentario de más de 2000 caracteres', { to: 'REJECTED', comment: 'a'.repeat(2001) }],
  ])('CA-04.3: 400 con %s', async (_case, payload) => {
    const created = await createAs('USER');

    const response = await transition('MANAGER', created.id, payload);

    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION');
  });
});

// --- CA-04.6: historial -------------------------------------------------------------------------

describe('GET /api/incidents/:id/events', () => {
  it('CA-04.6: devuelve el historial en orden cronológico con el actor, la fecha y los datos de cada tipo', async () => {
    const created = await createAs('USER');
    clock.advance(60_000);
    await api.call('PATCH', `/api/incidents/${created.id}`, {
      token: api.tokens.USER,
      payload: { priority: 'URGENT' },
    });
    clock.advance(60_000);
    await api.call('POST', `/api/incidents/${created.id}/assign`, {
      token: api.tokens.MANAGER,
      payload: { assigneeId: userId.USER },
    });
    clock.advance(60_000);
    await transition('USER', created.id, { to: 'IN_PROGRESS', comment: 'Voy.' });

    const response = await api.call('GET', `/api/incidents/${created.id}/events`, {
      token: api.tokens.DIRECTOR,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const minute = (n: number) => new Date(T0.getTime() + n * 60_000).toISOString();
    const pablo = { id: userId.USER, name: 'Pablo Moreno' };
    expect(IncidentEventList.parse(response.json())).toEqual([
      { id: expect.any(String), type: 'CREATED', actor: pablo, createdAt: minute(0), data: {} },
      {
        id: expect.any(String),
        type: 'UPDATED',
        actor: pablo,
        createdAt: minute(1),
        data: { changes: [{ field: 'priority', before: 'HIGH', after: 'URGENT' }] },
      },
      {
        id: expect.any(String),
        type: 'ASSIGNED',
        actor: { id: userId.MANAGER, name: 'Carmen Vidal' },
        createdAt: minute(2),
        data: { from: null, to: pablo },
      },
      {
        id: expect.any(String),
        type: 'STATUS_CHANGED',
        actor: pablo,
        createdAt: minute(3),
        data: { from: 'OPEN', to: 'IN_PROGRESS', comment: 'Voy.' },
      },
    ]);
  });

  it('CA-04.6: 404 con el mismo cuerpo si no existe, no es un UUID o no es visible', async () => {
    const foreign = await createAs('ADMIN', { typeId: typeId.QUALITY });

    for (const [role, id] of [
      ['ADMIN', MISSING_ID],
      ['ADMIN', 'no-es-un-uuid'],
      ['USER', foreign.id],
      ['MANAGER', foreign.id],
    ] as const) {
      const response = await api.call('GET', `/api/incidents/${id}/events`, {
        token: api.tokens[role],
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });
});

// --- CA-04.5: un evento por mutación ------------------------------------------------------------

describe('historial de las mutaciones', () => {
  it('CA-04.5: cada mutación de F03 y F04 deja exactamente un evento, y ninguno si no cambia nada o falla', async () => {
    const count = async () => (await eventRows()).length;
    const step = async (
      call: () => Promise<{ statusCode: number }>,
      status: number,
      added: number,
    ) => {
      const before = await count();
      clock.advance(60_000);
      expect((await call()).statusCode).toBe(status);
      expect((await count()) - before).toBe(added);
    };

    const created = await createAs('USER');
    expect(await count()).toBe(1);
    const url = `/api/incidents/${created.id}`;
    const patch = (payload: Record<string, unknown>) => () =>
      api.call('PATCH', url, { token: api.tokens.USER, payload });
    const assign = (assigneeId: string) => () =>
      api.call('POST', `${url}/assign`, { token: api.tokens.MANAGER, payload: { assigneeId } });
    const move = (role: Role, payload: Record<string, unknown>) => () =>
      transition(role, created.id, payload);

    await step(patch({ title: 'Otro título' }), 200, 1);
    await step(patch({ title: 'Otro título' }), 200, 0);
    await step(assign(userId.USER), 200, 1);
    await step(assign(userId.USER), 200, 0);
    await step(assign(userId.ADMIN), 400, 0);
    await step(move('USER', { to: 'IN_PROGRESS' }), 200, 1);
    await step(move('USER', { to: 'IN_PROGRESS' }), 409, 0);
    await step(move('USER', { to: 'RESOLVED' }), 400, 0);
    await step(move('DIRECTOR', { to: 'RESOLVED', comment: 'No.' }), 403, 0);
    await step(move('USER', { to: 'RESOLVED', comment: 'Hecho.' }), 200, 1);

    expect((await eventRows()).map((e) => [e.type, e.actorId])).toEqual([
      ['CREATED', userId.USER],
      ['UPDATED', userId.USER],
      ['ASSIGNED', userId.MANAGER],
      ['STATUS_CHANGED', userId.USER],
      ['STATUS_CHANGED', userId.USER],
    ]);
  });
});

// --- 401 ----------------------------------------------------------------------------------------

describe('sin sesión', () => {
  it.each([
    ['GET', '/api/incidents'],
    ['POST', '/api/incidents'],
    ['GET', `/api/incidents/${MISSING_ID}`],
    ['PATCH', `/api/incidents/${MISSING_ID}`],
    ['GET', `/api/incidents/${MISSING_ID}/assignees`],
    ['POST', `/api/incidents/${MISSING_ID}/assign`],
    ['POST', `/api/incidents/${MISSING_ID}/transitions`],
    ['GET', `/api/incidents/${MISSING_ID}/events`],
  ] as const)('%s %s → 401 (antes que la validación)', async (method, url) => {
    const response = await api.call(method, url, { payload: method === 'GET' ? undefined : {} });

    expect(response.statusCode).toBe(401);
    expect(errorOf(response).code).toBe('UNAUTHORIZED');
  });
});
