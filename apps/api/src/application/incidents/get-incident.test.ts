import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../errors';
import { makeGetIncident } from './get-incident';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  INCIDENT_USERS,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const getIncident = () => makeGetIncident({ incidents: world.incidents });

describe('getIncident', () => {
  it('CA-03.6: devuelve el detalle con las acciones del actor (Admin: update y assign)', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.LOG.id,
      createdById: INCIDENT_USERS.worker.id,
      assignedToId: INCIDENT_USERS.demoUser.id,
      dueDate: '2026-12-24',
    });

    const incident = await getIncident()(actorNamed('admin'), row.id);

    expect(incident).toMatchObject({
      id: row.id,
      code: row.code,
      department: DEPARTMENTS.LOG,
      createdBy: { id: INCIDENT_USERS.worker.id, name: 'Lucía Gómez' },
      assignee: { id: INCIDENT_USERS.demoUser.id, name: 'Pablo Moreno' },
      dueDate: '2026-12-24',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      allowedActions: ['update', 'assign'],
      allowedTransitions: [],
    });
  });

  it.each([
    ['director', []],
    ['manager', ['update', 'assign']],
    // Usuario del dpto. que no la ha creado: solo la ve.
    ['demoUser', []],
    ['worker', ['update']],
  ] as const)('CA-03.6: allowedActions de %s → %j', async (who, expected) => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.LOG.id,
      createdById: INCIDENT_USERS.worker.id,
    });

    const incident = await getIncident()(actorNamed(who), row.id);

    expect(incident.allowedActions).toEqual(expected);
  });

  it.each([
    ['no existe', '00000000-0000-4000-8000-00000000ffff'],
    ['no es un UUID', 'no-es-un-uuid'],
  ])('CA-03.6: 404 si la incidencia %s', async (_case, id) => {
    await expect(getIncident()(actorNamed('admin'), id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('CA-03.6: 404 si no es visible para el actor (otro dpto., ni creada ni asignada)', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.CAL.id,
      createdById: INCIDENT_USERS.admin.id,
    });

    await expect(getIncident()(actorNamed('worker'), row.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
