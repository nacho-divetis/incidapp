// Repositorios de incidencias sobre PGlite con las migraciones reales y el *seed*.
import { DEMO_USERS, INCIDENTS_PAGE_SIZE } from '@incidapp/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../../application/auth/test-fakes';
import {
  actorOf,
  canOnIncident,
  incidentVisibilityScope,
  type Actor,
} from '../../../application/authorization/authorization-policy';
import type { IncidentRecord } from '../../../application/ports/incident-repository';
import type { DatabaseHandle } from '../client';
import {
  codeCounters,
  departments,
  incidentEvents,
  incidents,
  incidentTypes,
  users,
} from '../schema';
import { seedDatabase } from '../seed';
import { createTestDatabase } from '../test-database';
import { createDrizzleUnitOfWork } from '../unit-of-work';
import { createDrizzleIncidentCodeCounter } from './incident-code-counter';
import { createDrizzleIncidentEventWriter } from './incident-event-writer';
import { createDrizzleIncidentRepository } from './incident-repository';
import { createDrizzleIncidentTypeRepository } from './incident-type-repository';
import { createDrizzleUserAdminRepository } from './user-admin-repository';

const T0 = new Date('2026-11-25T10:00:00.000Z');

let handle: DatabaseHandle;
let dept: Record<string, { id: string; code: string; name: string }>;
let type: Record<string, { id: string; departmentId: string }>;
let user: Record<'ADMIN' | 'DIRECTOR' | 'MANAGER' | 'USER', { id: string; name: string }>;

beforeAll(async () => {
  handle = await createTestDatabase();
  await seedDatabase(handle.db, { passwordHasher: new FakePasswordHasher() });
  dept = Object.fromEntries(
    (await handle.db.select().from(departments)).map((d) => [
      d.code,
      { id: d.id, code: d.code, name: d.name },
    ]),
  );
  type = Object.fromEntries(
    (await handle.db.select().from(incidentTypes)).map((t) => [
      t.code,
      { id: t.id, departmentId: t.defaultDepartmentId },
    ]),
  );
  const rows = await handle.db.select().from(users);
  user = Object.fromEntries(
    DEMO_USERS.map((demo) => {
      const row = rows.find((r) => r.email === demo.email)!;
      return [demo.role, { id: row.id, name: row.name }];
    }),
  ) as typeof user;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(incidentEvents);
  await handle.db.delete(incidents);
  await handle.db.delete(codeCounters);
});

let sequence = 0;

/** Crea una incidencia con el repositorio (tipo → dpto. propietario). */
async function create(
  typeCode: string,
  createdById: string,
  extra: { title?: string; priority?: 'LOW' | 'URGENT'; minutes?: number } = {},
): Promise<IncidentRecord> {
  sequence += 1;
  const t = type[typeCode]!;
  return createDrizzleIncidentRepository(handle.db).create({
    code: `INC-2026-${String(sequence).padStart(4, '0')}`,
    title: extra.title ?? `Incidencia ${sequence}`,
    description: 'Descripción de prueba.',
    typeId: t.id,
    departmentId: t.departmentId,
    priority: extra.priority ?? 'LOW',
    status: 'OPEN',
    createdById,
    dueDate: null,
    createdAt: new Date(T0.getTime() + (extra.minutes ?? sequence) * 60_000),
  });
}

const actorFor = async (role: keyof typeof user): Promise<Actor> => {
  const [managed] = [await createDrizzleUserAdminRepository(handle.db).findById(user[role].id)];
  return actorOf(managed!);
};

describe('createDrizzleIncidentTypeRepository', () => {
  it('CA-03.1: list devuelve los 7 tipos con su dpto. por defecto, por nombre', async () => {
    const types = await createDrizzleIncidentTypeRepository(handle.db).list();

    expect(types.map((t) => [t.name, t.department.code])).toEqual([
      ['Administrativa', 'ADM'],
      ['Calidad', 'CAL'],
      ['Cliente / Reclamación', 'ATC'],
      ['Interna / Operativa', 'PROD'],
      ['Proveedor', 'COMP'],
      ['Técnica / Instalación', 'TEC'],
      ['Transporte', 'LOG'],
    ]);
    expect(types.find((t) => t.code === 'TRANSPORT')?.department).toEqual(dept.LOG);
  });

  it('CA-03.3: findById devuelve null si no existe o no es un UUID', async () => {
    const repo = createDrizzleIncidentTypeRepository(handle.db);
    expect(await repo.findById(type.QUALITY!.id)).toMatchObject({ code: 'QUALITY' });
    expect(await repo.findById('00000000-0000-4000-8000-00000000ffff')).toBeNull();
    expect(await repo.findById('no-es-un-uuid')).toBeNull();
  });
});

describe('createDrizzleIncidentRepository', () => {
  it('CA-03.2: create guarda la incidencia y la devuelve con sus relaciones', async () => {
    const created = await create('TRANSPORT', user.USER.id, { title: 'Palé dañado' });

    expect(created).toEqual({
      id: expect.any(String),
      code: expect.stringMatching(/^INC-2026-\d{4}$/),
      title: 'Palé dañado',
      description: 'Descripción de prueba.',
      type: { id: type.TRANSPORT!.id, code: 'TRANSPORT', name: 'Transporte' },
      department: dept.LOG,
      priority: 'LOW',
      status: 'OPEN',
      createdBy: user.USER,
      assignee: null,
      dueDate: null,
      createdAt: expect.any(Date),
      updatedAt: created.createdAt,
      resolvedAt: null,
      closedAt: null,
    });
  });

  it('CA-03.6: findById devuelve null si no existe o el id no es un UUID', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    const created = await create('TRANSPORT', user.USER.id);

    expect(await repo.findById(created.id)).toEqual(created);
    expect(await repo.findById('00000000-0000-4000-8000-00000000ffff')).toBeNull();
    expect(await repo.findById('1 or 1=1')).toBeNull();
  });

  it('CA-03.9 · CA-03.10: findByIdForUpdate lee y bloquea la incidencia dentro de la transacción (con o sin asignado)', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    const unassigned = await create('TRANSPORT', user.USER.id);
    const assigned = await repo.update((await create('TRANSPORT', user.USER.id)).id, {
      assignedToId: user.MANAGER.id,
      updatedAt: T0,
    });

    const read = await createDrizzleUnitOfWork(handle.db).run(async (tx) => [
      await tx.incidents.findByIdForUpdate(unassigned.id),
      await tx.incidents.findByIdForUpdate(assigned.id),
      await tx.incidents.findByIdForUpdate('no-es-un-uuid'),
      await tx.incidents.findByIdForUpdate('00000000-0000-4000-8000-00000000ffff'),
    ]);

    expect(read).toEqual([unassigned, assigned, null, null]);
  });

  it('CA-03.9 · CA-03.10: update cambia solo los campos presentes, la fecha objetivo y el asignado', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    const created = await create('TRANSPORT', user.USER.id);
    const later = new Date(T0.getTime() + 86_400_000);

    await repo.update(created.id, { dueDate: '2026-12-24', updatedAt: later });
    const updated = await repo.update(created.id, {
      priority: 'URGENT',
      assignedToId: user.MANAGER.id,
      updatedAt: later,
    });

    expect(updated).toMatchObject({
      title: created.title,
      priority: 'URGENT',
      dueDate: '2026-12-24',
      assignee: user.MANAGER,
      updatedAt: later,
    });
    expect((await repo.update(created.id, { dueDate: null, updatedAt: later })).dueDate).toBeNull();
  });

  it.each(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'] as const)(
    'CA-03.7: el scope de %s devuelve exactamente las que canOnIncident deja ver',
    async (role) => {
      const repo = createDrizzleIncidentRepository(handle.db);
      const all = [
        await create('TRANSPORT', user.ADMIN.id), // LOG
        await create('QUALITY', user.USER.id), // CAL, creada por el Usuario
        await create('ADMINISTRATIVE', user.ADMIN.id), // ADM, se asigna al Responsable
        await create('TECHNICAL', user.ADMIN.id), // TEC, ninguna relación
      ];
      await repo.update(all[2]!.id, { assignedToId: user.MANAGER.id, updatedAt: T0 });
      const fresh = await Promise.all(all.map((i) => repo.findById(i.id)));
      const actor = await actorFor(role);
      const expected = fresh
        .filter((i) =>
          canOnIncident(
            actor,
            {
              ownerDepartmentId: i!.department.id,
              createdById: i!.createdBy.id,
              assignedToId: i!.assignee?.id ?? null,
              status: i!.status,
            },
            'view',
          ),
        )
        .map((i) => i!.id);

      const result = await repo.list({
        scope: incidentVisibilityScope(actor),
        filters: {},
        page: 1,
        pageSize: INCIDENTS_PAGE_SIZE,
      });

      expect(result.items.map((i) => i.id).sort()).toEqual([...expected].sort());
      expect(result.total).toBe(expected.length);
    },
  );

  it('CA-03.7: ordena de la más reciente a la más antigua y pagina; total cuenta todas', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    const created = [];
    for (let i = 0; i < 5; i += 1) created.push(await create('TRANSPORT', user.USER.id));

    const page1 = await repo.list({ scope: { kind: 'all' }, filters: {}, page: 1, pageSize: 2 });
    const page3 = await repo.list({ scope: { kind: 'all' }, filters: {}, page: 3, pageSize: 2 });

    expect(page1.items.map((i) => i.id)).toEqual([created[4]!.id, created[3]!.id]);
    expect(page3.items.map((i) => i.id)).toEqual([created[0]!.id]);
    expect(page1.total).toBe(5);
    expect(page3.total).toBe(5);
  });

  it('CA-03.8: los filtros se combinan con Y y nunca amplían el scope', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    const urgentLog = await create('TRANSPORT', user.ADMIN.id, {
      priority: 'URGENT',
      title: 'Camión averiado',
    });
    await create('TRANSPORT', user.ADMIN.id);
    const cal = await create('QUALITY', user.ADMIN.id, { priority: 'URGENT' });
    await repo.update(cal.id, { assignedToId: user.USER.id, updatedAt: T0 });
    const list = async (
      filters: Parameters<typeof repo.list>[0]['filters'],
      role: keyof typeof user = 'ADMIN',
    ) =>
      (
        await repo.list({
          scope: incidentVisibilityScope(await actorFor(role)),
          filters,
          page: 1,
          pageSize: 20,
        })
      ).items.map((i) => i.id);

    expect(await list({ priority: 'URGENT', departmentId: dept.LOG!.id })).toEqual([urgentLog.id]);
    expect(await list({ status: 'CLOSED' })).toEqual([]);
    expect(await list({ assignedToId: user.USER.id })).toEqual([cal.id]);
    expect(await list({ q: 'CAMIÓN' })).toEqual([urgentLog.id]);
    expect(await list({ q: urgentLog.code.toLowerCase() })).toEqual([urgentLog.id]);
    // El Responsable de LOG no ve CAL: filtrar por CAL no se la muestra.
    expect(await list({ departmentId: dept.CAL!.id }, 'MANAGER')).toEqual([]);
    // El Usuario la ve por tenerla asignada.
    expect(await list({ departmentId: dept.CAL!.id }, 'USER')).toEqual([cal.id]);
  });

  it('CA-03.8: q busca el texto literal (% y _ no son comodines)', async () => {
    const repo = createDrizzleIncidentRepository(handle.db);
    await create('TRANSPORT', user.ADMIN.id, { title: 'Descuento del 10 por ciento' });
    const percent = await create('TRANSPORT', user.ADMIN.id, { title: 'Descuento del 10%' });

    const result = await repo.list({
      scope: { kind: 'all' },
      filters: { q: '10%' },
      page: 1,
      pageSize: 20,
    });

    expect(result.items.map((i) => i.id)).toEqual([percent.id]);
  });
});

describe('createDrizzleIncidentCodeCounter', () => {
  it('CA-03.4: empieza en 1 por año y se incrementa', async () => {
    const counter = createDrizzleIncidentCodeCounter(handle.db);

    expect(await counter.next(2026)).toBe(1);
    expect(await counter.next(2026)).toBe(2);
    expect(await counter.next(2027)).toBe(1);
    expect(await counter.next(2026)).toBe(3);
  });

  it('CA-03.4: altas simultáneas en transacciones obtienen números distintos y sin huecos', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);

    const numbers = await Promise.all(
      Array.from({ length: 8 }, () => unitOfWork.run((tx) => tx.incidentCodes.next(2026))),
    );

    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('CA-03.4: una transacción revertida no consume número', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);
    await unitOfWork.run((tx) => tx.incidentCodes.next(2026));

    await expect(
      unitOfWork.run(async (tx) => {
        await tx.incidentCodes.next(2026);
        throw new Error('Fallo simulado');
      }),
    ).rejects.toThrow('Fallo simulado');

    expect(await unitOfWork.run((tx) => tx.incidentCodes.next(2026))).toBe(2);
  });
});

describe('createDrizzleIncidentEventWriter', () => {
  it('CA-03.2: append inserta el evento con su actor, datos y fecha', async () => {
    const incident = await create('TRANSPORT', user.USER.id);

    await createDrizzleIncidentEventWriter(handle.db).append({
      incidentId: incident.id,
      type: 'ASSIGNED',
      data: { from: null, to: user.MANAGER },
      actorId: user.ADMIN.id,
      createdAt: T0,
    });

    expect(await handle.db.select().from(incidentEvents)).toEqual([
      {
        id: expect.any(String),
        incidentId: incident.id,
        type: 'ASSIGNED',
        actorId: user.ADMIN.id,
        data: { from: null, to: user.MANAGER },
        createdAt: T0,
      },
    ]);
  });

  it('el puerto del historial solo ofrece append (solo de inserción)', () => {
    expect(Object.keys(createDrizzleIncidentEventWriter(handle.db))).toEqual(['append']);
  });
});

describe('createDrizzleUnitOfWork con incidencias', () => {
  it('CA-03.2: si falla el evento, no queda ni la incidencia ni el número consumido', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);
    const t = type.TRANSPORT!;

    await expect(
      unitOfWork.run(async (tx) => {
        const n = await tx.incidentCodes.next(2026);
        await tx.incidents.create({
          code: `INC-2026-${String(n).padStart(4, '0')}`,
          title: 'Revertida',
          description: 'No debe quedar.',
          typeId: t.id,
          departmentId: t.departmentId,
          priority: 'LOW',
          status: 'OPEN',
          createdById: user.USER.id,
          dueDate: null,
          createdAt: T0,
        });
        // Actor inexistente: viola la clave ajena y la transacción se revierte.
        await tx.incidentEvents.append({
          incidentId: '00000000-0000-4000-8000-00000000ffff',
          type: 'CREATED',
          data: {},
          actorId: user.USER.id,
          createdAt: T0,
        });
      }),
    ).rejects.toThrow();

    expect(await handle.db.select().from(incidents)).toEqual([]);
    expect(await handle.db.select().from(codeCounters).where(eq(codeCounters.year, 2026))).toEqual(
      [],
    );
  });
});

describe('UserAdminRepository.listActiveByDepartment', () => {
  it('CA-03.10: los usuarios activos del dpto., por nombre', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const extra = await repo.create({
      email: 'ana.baja@incidapp.test',
      name: 'Ana Baja',
      role: 'USER',
      departmentIds: [dept.LOG!.id],
      passwordHash: 'x',
      createdAt: T0,
    });
    const active = await repo.create({
      email: 'alberto.gil@incidapp.test',
      name: 'Alberto Gil',
      role: 'USER',
      departmentIds: [dept.LOG!.id, dept.CAL!.id],
      passwordHash: 'x',
      createdAt: T0,
    });
    await repo.setActive(extra.id, false);

    try {
      expect(await repo.listActiveByDepartment(dept.LOG!.id)).toEqual([
        { id: active.id, name: 'Alberto Gil' },
        user.MANAGER, // Carmen Vidal
        user.USER, // Pablo Moreno
      ]);
      expect(await repo.listActiveByDepartment(dept.TEC!.id)).toEqual([]);
    } finally {
      await handle.db.delete(users).where(eq(users.id, extra.id));
      await handle.db.delete(users).where(eq(users.id, active.id));
    }
  });
});
