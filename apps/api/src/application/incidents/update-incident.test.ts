import type { Status } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  FailingIncidentEvents,
  INCIDENT_USERS,
  NOW,
  type IncidentWorld,
} from './test-fakes';
import { makeUpdateIncident } from './update-incident';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const updateIncident = () =>
  makeUpdateIncident({
    unitOfWork: world.unitOfWork,
    clock: world.clock,
  });

const { worker, admin, manager } = INCIDENT_USERS;

/** Incidencia de LOG creada por la trabajadora. */
const logByWorker = (status: Status = 'OPEN') =>
  world.incidents.add({
    departmentId: DEPARTMENTS.LOG.id,
    createdById: worker.id,
    status,
    title: 'Título original',
    dueDate: '2026-12-01',
  });

describe('updateIncident', () => {
  it('CA-03.9: el creador edita una ABIERTA: 200 y evento UPDATED con los campos que cambian', async () => {
    const row = logByWorker();

    const incident = await updateIncident()({
      actor: actorNamed('worker'),
      id: row.id,
      input: { title: 'Título nuevo', priority: 'MEDIUM', dueDate: null },
    });

    expect(incident).toMatchObject({
      title: 'Título nuevo',
      priority: 'MEDIUM',
      dueDate: null,
      updatedAt: NOW.toISOString(),
      allowedActions: ['update'],
    });
    // La prioridad ya era MEDIUM: no cuenta como cambio.
    expect(world.incidentEvents.events).toEqual([
      {
        incidentId: row.id,
        type: 'UPDATED',
        data: {
          changes: [
            { field: 'title', before: 'Título original', after: 'Título nuevo' },
            { field: 'dueDate', before: '2026-12-01', after: null },
          ],
        },
        actorId: worker.id,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-03.9: si nada cambia, 200 sin evento ni escritura', async () => {
    const row = logByWorker();

    const incident = await updateIncident()({
      actor: actorNamed('worker'),
      id: row.id,
      input: { title: 'Título original', dueDate: '2026-12-01' },
    });

    expect(incident.updatedAt).toBe(row.updatedAt.toISOString());
    expect(world.incidents.rows[0]?.updatedAt).toEqual(row.updatedAt);
    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.9 (decisión 3): el Admin edita una CERRADA y el Responsable una de su dpto.', async () => {
    const closed = logByWorker('CLOSED');
    const open = logByWorker();

    await expect(
      updateIncident()({ actor: actorNamed('admin'), id: closed.id, input: { title: 'A' } }),
    ).resolves.toMatchObject({ title: 'A' });
    await expect(
      updateIncident()({ actor: actorNamed('manager'), id: open.id, input: { title: 'B' } }),
    ).resolves.toMatchObject({ title: 'B' });
  });

  it.each([
    ['Dirección', 'director', 'OPEN'],
    ['el Usuario creador fuera de ABIERTA', 'worker', 'IN_PROGRESS'],
    ['un Usuario del dpto. que no la ha creado', 'demoUser', 'OPEN'],
  ] as const)('CA-03.9: 403 para %s', async (_case, who, status) => {
    const row = logByWorker(status);

    await expect(
      updateIncident()({ actor: actorNamed(who), id: row.id, input: { title: 'X' } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.9: 403 para el Responsable sobre una de otro dpto. que no ha creado (asignada)', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.CAL.id,
      createdById: admin.id,
      assignedToId: manager.id,
    });

    await expect(
      updateIncident()({ actor: actorNamed('manager'), id: row.id, input: { title: 'X' } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('CA-03.9: 404 si no es visible o no existe', async () => {
    const row = world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id });

    await expect(
      updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'X' } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateIncident()({ actor: actorNamed('admin'), id: 'no-existe', input: { title: 'X' } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('CA-03.9: lee la incidencia bloqueándola dentro de la transacción', async () => {
    const row = logByWorker();

    await updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'X' } });

    // El fake falla si `findByIdForUpdate` se llama fuera de `unitOfWork.run`.
    expect(world.incidents.lockedReads).toBe(1);
    expect(world.unitOfWork.runs).toBe(1);
  });

  it('CA-03.9: si otra petición cambia el estado antes del bloqueo, la regla "solo en ABIERTA" usa el estado nuevo (403)', async () => {
    const row = logByWorker();
    world.incidents.concurrentChange = (stored) => {
      stored.status = 'IN_PROGRESS';
    };

    await expect(
      updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'X' } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.9: el "antes" del evento UPDATED es el de la lectura bloqueada, no uno desfasado', async () => {
    const row = logByWorker();
    world.incidents.concurrentChange = (stored) => {
      stored.title = 'Título de otra petición';
    };

    await updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'Mío' } });

    expect(world.incidentEvents.events[0]?.data).toEqual({
      changes: [{ field: 'title', before: 'Título de otra petición', after: 'Mío' }],
    });
  });

  it('CA-03.9: si otra petición ya dejó el mismo valor, 200 sin evento', async () => {
    const row = logByWorker();
    world.incidents.concurrentChange = (stored) => {
      stored.title = 'Mío';
    };

    await updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'Mío' } });

    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.9: si falla el evento, el cambio se revierte', async () => {
    const row = logByWorker();
    world.unitOfWork.incidentEvents = new FailingIncidentEvents();

    await expect(
      updateIncident()({ actor: actorNamed('worker'), id: row.id, input: { title: 'X' } }),
    ).rejects.toThrow('Fallo simulado del historial');

    expect(world.incidents.rows[0]?.title).toBe('Título original');
  });
});
