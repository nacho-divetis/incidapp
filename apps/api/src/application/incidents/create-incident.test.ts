import { Incident, type CreateIncidentInput } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, ValidationError } from '../errors';
import { makeCreateIncident } from './create-incident';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  FailingIncidentEvents,
  INCIDENT_TYPES,
  INCIDENT_USERS,
  NOW,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const createIncident = () =>
  makeCreateIncident({
    incidentTypes: world.incidentTypes,
    unitOfWork: world.unitOfWork,
    clock: world.clock,
  });

const INPUT: CreateIncidentInput = {
  title: 'Retraso en la entrega',
  description: 'El transportista no ha llegado a la hora acordada.',
  typeId: INCIDENT_TYPES.TRANSPORT.id,
  priority: 'HIGH',
  dueDate: '2026-12-01',
};

describe('createIncident', () => {
  it('CA-03.2: crea la incidencia ABIERTA en el dpto. del tipo, creada por el actor y sin asignado', async () => {
    const worker = actorNamed('worker');

    const incident = await createIncident()({ actor: worker, input: INPUT });

    expect(incident).toEqual({
      id: expect.any(String),
      code: 'INC-2026-0001',
      title: INPUT.title,
      description: INPUT.description,
      type: { id: INCIDENT_TYPES.TRANSPORT.id, code: 'TRANSPORT', name: 'Transporte' },
      department: DEPARTMENTS.LOG,
      priority: 'HIGH',
      status: 'OPEN',
      createdBy: { id: worker.id, name: worker.name },
      assignee: null,
      dueDate: '2026-12-01',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      resolvedAt: null,
      closedAt: null,
      // Usuario creador de una ABIERTA: puede editarla, no asignarla.
      allowedActions: ['update'],
      allowedTransitions: [],
    });
    expect(() => Incident.parse(incident)).not.toThrow();
  });

  it('CA-03.2: inserta un evento CREATED con el actor en la misma unidad de trabajo', async () => {
    const incident = await createIncident()({ actor: actorNamed('worker'), input: INPUT });

    expect(world.unitOfWork.runs).toBe(1);
    expect(world.incidentEvents.events).toEqual([
      {
        incidentId: incident.id,
        type: 'CREATED',
        data: {},
        actorId: INCIDENT_USERS.worker.id,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-03.2: el Responsable del dpto. del tipo recibe update y assign', async () => {
    const incident = await createIncident()({ actor: actorNamed('manager'), input: INPUT });
    expect(incident.allowedActions).toEqual(['update', 'assign']);
  });

  it('CA-03.2: sin fecha objetivo, dueDate es null', async () => {
    const { dueDate: _dueDate, ...withoutDueDate } = INPUT;
    const incident = await createIncident()({ actor: actorNamed('admin'), input: withoutDueDate });
    expect(incident.dueDate).toBeNull();
  });

  it('CA-03.4: los códigos son correlativos en el año', async () => {
    const create = createIncident();
    const codes = [];
    for (let i = 0; i < 3; i += 1) {
      codes.push((await create({ actor: actorNamed('worker'), input: INPUT })).code);
    }
    expect(codes).toEqual(['INC-2026-0001', 'INC-2026-0002', 'INC-2026-0003']);
  });

  it('CA-03.4: el año es el de Madrid y la primera de un año nuevo vuelve a 0001', async () => {
    const create = createIncident();
    await create({ actor: actorNamed('worker'), input: INPUT });
    // 31/12 a las 23:30 UTC ya es 2027 en Madrid.
    world.clock.current = new Date('2026-12-31T23:30:00.000Z');

    const incident = await create({ actor: actorNamed('worker'), input: INPUT });

    expect(incident.code).toBe('INC-2027-0001');
  });

  it('CA-03.3: un tipo inexistente es 400 en typeId y no crea nada ni consume código', async () => {
    const error = await createIncident()({
      actor: actorNamed('worker'),
      input: { ...INPUT, typeId: '00000000-0000-4000-8000-00000000ffff' },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      details: [{ path: 'typeId', message: 'El tipo de incidencia no existe.' }],
    });
    expect(world.incidents.rows).toEqual([]);
    expect(world.incidentCodes.counters.size).toBe(0);
    expect(world.incidentEvents.events).toEqual([]);
  });

  it('CA-03.5: Dirección no puede crear (403) y no se crea nada', async () => {
    const error = await createIncident()({ actor: actorNamed('director'), input: INPUT }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(world.unitOfWork.runs).toBe(0);
    expect(world.incidents.rows).toEqual([]);
  });

  it('CA-03.4: si falla el evento, se revierte el alta y no se consume el código', async () => {
    world.unitOfWork.incidentEvents = new FailingIncidentEvents();

    await expect(createIncident()({ actor: actorNamed('worker'), input: INPUT })).rejects.toThrow(
      'Fallo simulado del historial',
    );

    expect(world.incidents.rows).toEqual([]);
    expect(world.incidentCodes.counters.size).toBe(0);
  });
});
