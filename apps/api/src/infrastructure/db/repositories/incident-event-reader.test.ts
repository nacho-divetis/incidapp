// Lectura del historial sobre PGlite con las migraciones reales y el *seed* (CA-04.5, CA-04.6).
import { DEMO_USERS } from '@incidapp/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { FakePasswordHasher } from '../../../application/auth/test-fakes';
import type { IncidentEventReader } from '../../../application/ports/incident-event-reader';
import type { IncidentEventWriter } from '../../../application/ports/incident-event-writer';
import type { DatabaseHandle } from '../client';
import { incidentEvents, incidents, incidentTypes, users } from '../schema';
import { seedDatabase } from '../seed';
import { createTestDatabase } from '../test-database';
import { createDrizzleIncidentEventReader } from './incident-event-reader';
import { createDrizzleIncidentEventWriter } from './incident-event-writer';
import { createDrizzleIncidentRepository } from './incident-repository';

const T0 = new Date('2026-11-25T10:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let handle: DatabaseHandle;
let user: Record<'ADMIN' | 'MANAGER' | 'USER', { id: string; name: string }>;
let typeId: string;
let departmentId: string;

beforeAll(async () => {
  handle = await createTestDatabase();
  await seedDatabase(handle.db, { passwordHasher: new FakePasswordHasher() });
  const rows = await handle.db.select().from(users);
  user = Object.fromEntries(
    DEMO_USERS.map((demo) => {
      const row = rows.find((r) => r.email === demo.email)!;
      return [demo.role, { id: row.id, name: row.name }];
    }),
  ) as typeof user;
  const [type] = await handle.db.select().from(incidentTypes);
  typeId = type!.id;
  departmentId = type!.defaultDepartmentId;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(incidentEvents);
  await handle.db.delete(incidents);
});

let sequence = 0;
async function createIncident(): Promise<string> {
  sequence += 1;
  const incident = await createDrizzleIncidentRepository(handle.db).create({
    code: `INC-2026-${String(sequence).padStart(4, '0')}`,
    title: `Incidencia ${sequence}`,
    description: 'Descripción de prueba.',
    typeId,
    departmentId,
    priority: 'LOW',
    status: 'OPEN',
    createdById: user.USER.id,
    dueDate: null,
    createdAt: T0,
  });
  return incident.id;
}

describe('createDrizzleIncidentEventReader', () => {
  it('CA-04.6: listByIncident devuelve los de la incidencia, del más antiguo al más reciente, con el actor', async () => {
    const id = await createIncident();
    const other = await createIncident();
    const writer = createDrizzleIncidentEventWriter(handle.db);
    // Se insertan desordenados: el orden sale de `created_at`, no de la inserción.
    await writer.append({
      incidentId: id,
      type: 'STATUS_CHANGED',
      data: { from: 'OPEN', to: 'REJECTED', comment: 'No procede.' },
      actorId: user.MANAGER.id,
      createdAt: at(2),
    });
    await writer.append({
      incidentId: id,
      type: 'CREATED',
      data: {},
      actorId: user.USER.id,
      createdAt: at(0),
    });
    await writer.append({
      incidentId: other,
      type: 'CREATED',
      data: {},
      actorId: user.USER.id,
      createdAt: at(1),
    });
    await writer.append({
      incidentId: id,
      type: 'UPDATED',
      data: { changes: [{ field: 'priority', before: 'LOW', after: 'URGENT' }] },
      actorId: user.ADMIN.id,
      createdAt: at(1),
    });

    const events = await createDrizzleIncidentEventReader(handle.db).listByIncident(id);

    expect(events).toEqual([
      { id: expect.any(String), type: 'CREATED', data: {}, actor: user.USER, createdAt: at(0) },
      {
        id: expect.any(String),
        type: 'UPDATED',
        data: { changes: [{ field: 'priority', before: 'LOW', after: 'URGENT' }] },
        actor: user.ADMIN,
        createdAt: at(1),
      },
      {
        id: expect.any(String),
        type: 'STATUS_CHANGED',
        data: { from: 'OPEN', to: 'REJECTED', comment: 'No procede.' },
        actor: user.MANAGER,
        createdAt: at(2),
      },
    ]);
  });

  it('CA-04.6: a igual fecha, desempata por id (orden estable)', async () => {
    const id = await createIncident();
    const writer = createDrizzleIncidentEventWriter(handle.db);
    for (let i = 0; i < 5; i += 1) {
      await writer.append({
        incidentId: id,
        type: 'CREATED',
        data: {},
        actorId: user.USER.id,
        createdAt: T0,
      });
    }

    const ids = (await createDrizzleIncidentEventReader(handle.db).listByIncident(id)).map(
      (event) => event.id,
    );

    expect(ids).toEqual([...ids].sort());
  });

  it('CA-04.6: una incidencia sin eventos o un id que no es un UUID devuelven []', async () => {
    const reader = createDrizzleIncidentEventReader(handle.db);
    expect(await reader.listByIncident(await createIncident())).toEqual([]);
    expect(await reader.listByIncident('no-es-un-uuid')).toEqual([]);
  });
});

describe('CA-04.5: el historial es solo de inserción', () => {
  it('ni los puertos ni los adaptadores ofrecen actualizar ni borrar', () => {
    expectTypeOf<keyof IncidentEventWriter>().toEqualTypeOf<'append'>();
    expectTypeOf<keyof IncidentEventReader>().toEqualTypeOf<'listByIncident'>();
    expect(Object.keys(createDrizzleIncidentEventWriter(handle.db))).toEqual(['append']);
    expect(Object.keys(createDrizzleIncidentEventReader(handle.db))).toEqual(['listByIncident']);
  });
});
