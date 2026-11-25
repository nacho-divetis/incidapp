import type { AllowedTransition, Status } from '@incidapp/shared';
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
      allowedTransitions: [
        { to: 'IN_PROGRESS', requiresComment: false },
        { to: 'REJECTED', requiresComment: true },
      ],
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

  // CA-04.4: transiciones que salen de cada estado (`permisos.md` → Transiciones de estado), según
  // lo que puede hacer el actor: todas (Admin, Responsable de sus dptos.), solo las operativas
  // (Usuario creador o asignado, Responsable fuera de sus dptos. con nota ²) o ninguna.
  const op = (to: Status, requiresComment = false): AllowedTransition => ({ to, requiresComment });
  const ALL: Record<Status, AllowedTransition[]> = {
    OPEN: [op('IN_PROGRESS'), op('REJECTED', true)],
    IN_PROGRESS: [op('PENDING_THIRD_PARTY'), op('RESOLVED', true)],
    PENDING_THIRD_PARTY: [op('IN_PROGRESS')],
    RESOLVED: [op('IN_PROGRESS', true), op('CLOSED')],
    CLOSED: [op('REOPENED', true)],
    REJECTED: [],
    REOPENED: [op('IN_PROGRESS')],
  };
  const OPERATIONAL: Record<Status, AllowedTransition[]> = {
    OPEN: [op('IN_PROGRESS')],
    IN_PROGRESS: [op('PENDING_THIRD_PARTY'), op('RESOLVED', true)],
    PENDING_THIRD_PARTY: [op('IN_PROGRESS')],
    RESOLVED: [],
    CLOSED: [],
    REJECTED: [],
    REOPENED: [op('IN_PROGRESS')],
  };
  const NONE = Object.fromEntries(
    Object.keys(ALL).map((status) => [status, []]),
  ) as unknown as Record<Status, AllowedTransition[]>;

  const { worker, manager, demoUser, admin } = INCIDENT_USERS;
  const RELATIONS = [
    ['Admin', 'admin', DEPARTMENTS.CAL.id, admin.id, null, ALL],
    ['Dirección', 'director', DEPARTMENTS.LOG.id, worker.id, null, NONE],
    ['Responsable de su dpto.', 'manager', DEPARTMENTS.LOG.id, worker.id, null, ALL],
    [
      'Responsable fuera de sus dptos. y asignado (nota ²)',
      'manager',
      DEPARTMENTS.CAL.id,
      admin.id,
      manager.id,
      OPERATIONAL,
    ],
    [
      'Responsable fuera de sus dptos. y creador (nota ²)',
      'manager',
      DEPARTMENTS.CAL.id,
      manager.id,
      null,
      OPERATIONAL,
    ],
    ['Usuario creador', 'worker', DEPARTMENTS.LOG.id, worker.id, null, OPERATIONAL],
    [
      'Usuario asignado de otro dpto.',
      'worker',
      DEPARTMENTS.CAL.id,
      admin.id,
      worker.id,
      OPERATIONAL,
    ],
    ['Usuario del dpto. sin relación', 'demoUser', DEPARTMENTS.LOG.id, worker.id, null, NONE],
  ] as const;
  const STATUSES = Object.keys(ALL) as Status[];

  it.each(
    RELATIONS.flatMap(([label, who, departmentId, createdById, assignedToId, expected]) =>
      STATUSES.map(
        (status) =>
          [label, status, who, departmentId, createdById, assignedToId, expected[status]] as const,
      ),
    ),
  )(
    'CA-04.4: allowedTransitions de %s en %s',
    async (_label, status, who, departmentId, createdById, assignedToId, expected) => {
      const row = world.incidents.add({ departmentId, createdById, assignedToId, status });

      const incident = await getIncident()(actorNamed(who), row.id);

      expect(incident.allowedTransitions).toEqual(expected);
    },
  );

  it('CA-04.4: allowedActions no cambia con F04 (sin comment)', async () => {
    const row = world.incidents.add({
      departmentId: DEPARTMENTS.LOG.id,
      createdById: demoUser.id,
      status: 'IN_PROGRESS',
    });

    const incident = await getIncident()(actorNamed('admin'), row.id);

    expect(incident.allowedActions).toEqual(['update', 'assign']);
  });
});
