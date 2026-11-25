import { IncidentEventList } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../errors';
import { makeChangeIncidentStatus } from './change-incident-status';
import { makeCreateIncident } from './create-incident';
import { makeListIncidentEvents } from './list-incident-events';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  INCIDENT_TYPES,
  INCIDENT_USERS,
  NOW,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const listEvents = () =>
  makeListIncidentEvents({ incidents: world.incidents, incidentEvents: world.incidentEventReader });

const { worker, admin } = INCIDENT_USERS;

describe('listIncidentEvents', () => {
  it('CA-04.6: devuelve los eventos en orden cronológico, con el actor y la fecha ISO', async () => {
    const created = await makeCreateIncident(world)({
      actor: actorNamed('worker'),
      input: {
        title: 'Palé dañado',
        description: 'Llegó roto.',
        typeId: INCIDENT_TYPES.TRANSPORT.id,
        priority: 'LOW',
      },
    });
    world.clock.advance(60_000);
    await makeChangeIncidentStatus(world)({
      actor: actorNamed('manager'),
      id: created.id,
      input: { to: 'REJECTED', comment: 'No procede.' },
    });

    const events = await listEvents()(actorNamed('worker'), created.id);

    expect(IncidentEventList.parse(events)).toEqual(events);
    expect(events).toEqual([
      {
        id: expect.any(String),
        type: 'CREATED',
        actor: { id: worker.id, name: 'Lucía Gómez' },
        createdAt: NOW.toISOString(),
        data: {},
      },
      {
        id: expect.any(String),
        type: 'STATUS_CHANGED',
        actor: { id: INCIDENT_USERS.manager.id, name: 'Jorge Sanz' },
        createdAt: new Date(NOW.getTime() + 60_000).toISOString(),
        data: { from: 'OPEN', to: 'REJECTED', comment: 'No procede.' },
      },
    ]);
  });

  it('CA-04.6: Dirección ve el historial de cualquier incidencia', async () => {
    const row = world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id });

    await expect(listEvents()(actorNamed('director'), row.id)).resolves.toEqual([]);
  });

  it.each([
    ['no existe', '00000000-0000-4000-8000-00000000ffff'],
    ['no es un UUID', 'no-es-un-uuid'],
  ])('CA-04.6: 404 si la incidencia %s', async (_case, id) => {
    await expect(listEvents()(actorNamed('admin'), id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('CA-04.6: 404 si no es visible para el actor', async () => {
    const row = world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id });

    await expect(listEvents()(actorNamed('worker'), row.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
