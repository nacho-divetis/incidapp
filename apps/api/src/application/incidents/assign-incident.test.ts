import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { makeAssignIncident } from './assign-incident';
import { makeListAssignees } from './list-assignees';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  INCIDENT_USERS,
  NOW,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const listAssignees = () => makeListAssignees({ incidents: world.incidents, users: world.users });
const assignIncident = () =>
  makeAssignIncident({
    unitOfWork: world.unitOfWork,
    clock: world.clock,
  });

const { worker, admin, manager, demoUser, inactiveLog, inactive } = INCIDENT_USERS;
const INVALID_ASSIGNEE =
  'El usuario no pertenece al departamento de la incidencia o está desactivado.';

const logIncident = () =>
  world.incidents.add({ departmentId: DEPARTMENTS.LOG.id, createdById: worker.id });

describe('listAssignees', () => {
  it('CA-03.10: los usuarios activos del dpto. propietario, por nombre', async () => {
    const row = logIncident();

    const result = await listAssignees()(actorNamed('manager'), row.id);

    expect(result).toEqual([
      { id: manager.id, name: 'Jorge Sanz' },
      { id: worker.id, name: 'Lucía Gómez' },
      { id: demoUser.id, name: 'Pablo Moreno' },
    ]);
  });

  it.each(['worker', 'director'] as const)('CA-03.10: 403 para %s', async (who) => {
    const row = logIncident();
    await expect(listAssignees()(actorNamed(who), row.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('CA-03.10: 404 si no es visible', async () => {
    const row = world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id });
    await expect(listAssignees()(actorNamed('manager'), row.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('assignIncident', () => {
  it('CA-03.10: asigna a un usuario activo del dpto. y registra ASSIGNED', async () => {
    const row = logIncident();

    const incident = await assignIncident()({
      actor: actorNamed('manager'),
      id: row.id,
      input: { assigneeId: demoUser.id },
    });

    expect(incident).toMatchObject({
      assignee: { id: demoUser.id, name: 'Pablo Moreno' },
      updatedAt: NOW.toISOString(),
      allowedActions: ['update', 'assign'],
    });
    expect(world.incidentEvents.events).toEqual([
      {
        incidentId: row.id,
        type: 'ASSIGNED',
        data: { from: null, to: { id: demoUser.id, name: 'Pablo Moreno' } },
        actorId: manager.id,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-03.10: reasignar registra el asignado anterior; al mismo, 200 sin evento', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.LOG.id,
      createdById: worker.id,
      assignedToId: worker.id,
    });
    const assign = assignIncident();

    await assign({ actor: actorNamed('admin'), id: row.id, input: { assigneeId: worker.id } });
    expect(world.incidentEvents.events).toEqual([]);

    await assign({ actor: actorNamed('admin'), id: row.id, input: { assigneeId: demoUser.id } });
    expect(world.incidentEvents.events[0]?.data).toEqual({
      from: { id: worker.id, name: 'Lucía Gómez' },
      to: { id: demoUser.id, name: 'Pablo Moreno' },
    });
  });

  it.each([
    ['desactivado del dpto.', inactiveLog.id],
    ['de otro dpto.', admin.id],
    ['desactivado de otro dpto.', inactive.id],
    ['inexistente', '00000000-0000-4000-8000-00000000ffff'],
  ])('CA-03.10: un asignado %s es 400 y no cambia nada', async (_case, assigneeId) => {
    const row = logIncident();

    const error = await assignIncident()({
      actor: actorNamed('manager'),
      id: row.id,
      input: { assigneeId },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      message: INVALID_ASSIGNEE,
      details: [{ path: 'assigneeId', message: INVALID_ASSIGNEE }],
    });
    expect(world.incidents.rows[0]?.assignedToId).toBeNull();
    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.10: lee la incidencia bloqueándola dentro de la transacción', async () => {
    const row = logIncident();

    await assignIncident()({
      actor: actorNamed('manager'),
      id: row.id,
      input: { assigneeId: worker.id },
    });

    expect(world.incidents.lockedReads).toBe(1);
  });

  it('CA-03.10: el asignado anterior del evento es el de la lectura bloqueada', async () => {
    const row = logIncident();
    world.incidents.concurrentChange = (stored) => {
      stored.assignedToId = manager.id;
    };

    await assignIncident()({
      actor: actorNamed('admin'),
      id: row.id,
      input: { assigneeId: worker.id },
    });

    expect(world.incidentEvents.events[0]?.data).toEqual({
      from: { id: manager.id, name: 'Jorge Sanz' },
      to: { id: worker.id, name: 'Lucía Gómez' },
    });
  });

  it('CA-03.10: el candidato se comprueba dentro de la transacción (desactivado mientras tanto → 400)', async () => {
    const row = logIncident();
    // Fuera de la transacción la trabajadora sigue activa; dentro, otra petición ya la ha desactivado.
    expect(await world.users.listActiveByDepartment(DEPARTMENTS.LOG.id)).toContainEqual({
      id: worker.id,
      name: 'Lucía Gómez',
    });
    world.unitOfWork.transactional = {
      users: Object.assign(Object.create(world.users) as typeof world.users, {
        listActiveByDepartment: async () => [],
      }),
    };

    const error = await assignIncident()({
      actor: actorNamed('manager'),
      id: row.id,
      input: { assigneeId: worker.id },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(world.incidents.rows[0]?.assignedToId).toBeNull();
  });

  it('CA-03.10 (nota ²): si otra petición mueve la incidencia fuera del dpto. del Responsable antes del bloqueo, 404', async () => {
    const row = logIncident();
    world.incidents.concurrentChange = (stored) => {
      stored.departmentId = DEPARTMENTS.CAL.id;
    };

    await expect(
      assignIncident()({
        actor: actorNamed('manager'),
        id: row.id,
        input: { assigneeId: worker.id },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['worker', 'director'] as const)('CA-03.10: 403 para %s', async (who) => {
    const row = logIncident();
    await expect(
      assignIncident()({ actor: actorNamed(who), id: row.id, input: { assigneeId: worker.id } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('CA-03.10 (nota ²): el Responsable no asigna fuera de sus dptos. aunque la tenga asignada', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.CAL.id,
      createdById: admin.id,
      assignedToId: manager.id,
    });
    await expect(
      assignIncident()({
        actor: actorNamed('manager'),
        id: row.id,
        input: { assigneeId: manager.id },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('CA-03.10: 404 (antes que el 400) si no es visible', async () => {
    const row = world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id });
    await expect(
      assignIncident()({
        actor: actorNamed('manager'),
        id: row.id,
        input: { assigneeId: '00000000-0000-4000-8000-00000000ffff' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
