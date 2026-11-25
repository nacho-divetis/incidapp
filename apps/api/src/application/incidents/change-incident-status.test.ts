import type { Status } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { makeChangeIncidentStatus } from './change-incident-status';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  FailingIncidentEvents,
  INCIDENT_USERS,
  NOW,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const changeStatus = () =>
  makeChangeIncidentStatus({ unitOfWork: world.unitOfWork, clock: world.clock });

const { worker, admin, manager } = INCIDENT_USERS;
const COMMENT_REQUIRED = 'Esta transición requiere un comentario.';

/** Incidencia de LOG creada por la trabajadora, en el estado indicado. */
const logIncident = (status: Status = 'OPEN') =>
  world.incidents.add({ departmentId: DEPARTMENTS.LOG.id, createdById: worker.id, status });

describe('changeIncidentStatus', () => {
  it('CA-04.2: cambia el estado, devuelve la incidencia recalculada y registra STATUS_CHANGED', async () => {
    const row = logIncident('OPEN');

    const incident = await changeStatus()({
      actor: actorNamed('worker'),
      id: row.id,
      input: { to: 'IN_PROGRESS' },
    });

    expect(incident).toMatchObject({
      status: 'IN_PROGRESS',
      updatedAt: NOW.toISOString(),
      resolvedAt: null,
      closedAt: null,
      // Ya no está ABIERTA: el creador deja de poder editarla.
      allowedActions: [],
      allowedTransitions: [
        { to: 'PENDING_THIRD_PARTY', requiresComment: false },
        { to: 'RESOLVED', requiresComment: true },
      ],
    });
    expect(world.incidents.rows[0]?.status).toBe('IN_PROGRESS');
    expect(world.incidentEvents.events).toEqual([
      {
        incidentId: row.id,
        type: 'STATUS_CHANGED',
        data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
        actorId: worker.id,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-04.2: guarda el comentario en el evento', async () => {
    const row = logIncident('OPEN');

    await changeStatus()({
      actor: actorNamed('manager'),
      id: row.id,
      input: { to: 'REJECTED', comment: 'Duplicada de INC-2026-0001.' },
    });

    expect(world.incidentEvents.events[0]?.data).toEqual({
      from: 'OPEN',
      to: 'REJECTED',
      comment: 'Duplicada de INC-2026-0001.',
    });
  });

  it('CA-04.2: al entrar en RESUELTA guarda resolvedAt y al entrar en CERRADA, closedAt (la última fecha)', async () => {
    const row = logIncident('IN_PROGRESS');
    const change = changeStatus();
    const as = actorNamed('manager');
    const step = async (to: Status, comment?: string) => {
      world.clock.advance(60_000);
      return change({ actor: as, id: row.id, input: { to, comment } });
    };

    const resolved = await step('RESOLVED', 'Reparado.');
    const firstResolvedAt = world.clock.now().toISOString();
    expect(resolved).toMatchObject({ resolvedAt: firstResolvedAt, closedAt: null });

    const closed = await step('CLOSED');
    const firstClosedAt = world.clock.now().toISOString();
    expect(closed).toMatchObject({ resolvedAt: firstResolvedAt, closedAt: firstClosedAt });

    // Reabrir y volver a en curso no borra las fechas (decisión 5).
    await step('REOPENED', 'Ha vuelto a fallar.');
    const inProgress = await step('IN_PROGRESS');
    expect(inProgress).toMatchObject({ resolvedAt: firstResolvedAt, closedAt: firstClosedAt });

    const resolvedAgain = await step('RESOLVED', 'Reparado de nuevo.');
    const lastResolvedAt = world.clock.now().toISOString();
    const closedAgain = await step('CLOSED');
    expect(resolvedAgain.resolvedAt).toBe(lastResolvedAt);
    expect(closedAgain).toMatchObject({
      resolvedAt: lastResolvedAt,
      closedAt: world.clock.now().toISOString(),
    });
    expect(world.incidentEvents.events.map((event) => event.data)).toEqual([
      { from: 'IN_PROGRESS', to: 'RESOLVED', comment: 'Reparado.' },
      { from: 'RESOLVED', to: 'CLOSED', comment: null },
      { from: 'CLOSED', to: 'REOPENED', comment: 'Ha vuelto a fallar.' },
      { from: 'REOPENED', to: 'IN_PROGRESS', comment: null },
      { from: 'IN_PROGRESS', to: 'RESOLVED', comment: 'Reparado de nuevo.' },
      { from: 'RESOLVED', to: 'CLOSED', comment: null },
    ]);
  });

  it('CA-04.2: si falla el evento, se revierte el cambio de estado', async () => {
    const row = logIncident('OPEN');
    const before = structuredClone(row);
    world.unitOfWork.incidentEvents = new FailingIncidentEvents();

    await expect(
      changeStatus()({ actor: actorNamed('admin'), id: row.id, input: { to: 'IN_PROGRESS' } }),
    ).rejects.toThrow('Fallo simulado del historial');

    expect(world.incidents.rows).toEqual([before]);
  });

  it('CA-04.2: decide sobre la lectura bloqueada dentro de la transacción (el from del evento es el de esa lectura)', async () => {
    const row = logIncident('OPEN');
    // Otra petición la cierra y la reabre justo antes de que esta consiga el bloqueo.
    world.incidents.concurrentChange = (stored) => {
      stored.status = 'REOPENED';
    };

    await changeStatus()({ actor: actorNamed('admin'), id: row.id, input: { to: 'IN_PROGRESS' } });

    expect(world.incidents.lockedReads).toBe(1);
    expect(world.incidentEvents.events[0]?.data).toEqual({
      from: 'REOPENED',
      to: 'IN_PROGRESS',
      comment: null,
    });
  });

  it('CA-04.3: si el estado cambió antes del bloqueo y la transición ya no existe, 409', async () => {
    const row = logIncident('OPEN');
    world.incidents.concurrentChange = (stored) => {
      stored.status = 'IN_PROGRESS';
    };

    await expect(
      changeStatus()({ actor: actorNamed('admin'), id: row.id, input: { to: 'IN_PROGRESS' } }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(world.incidentEvents.events).toEqual([]);
  });

  describe('CA-04.3: errores en orden 404 → 409 → 403 → 400', () => {
    it.each([
      ['no existe', '00000000-0000-4000-8000-00000000ffff'],
      ['no es un UUID', 'no-es-un-uuid'],
    ])('404 si la incidencia %s', async (_case, id) => {
      await expect(
        changeStatus()({ actor: actorNamed('admin'), id, input: { to: 'IN_PROGRESS' } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('404 (antes que el 409) si no es visible', async () => {
      const row = world.incidents.add({
        departmentId: DEPARTMENTS.CAL.id,
        createdById: admin.id,
        status: 'REJECTED',
      });

      await expect(
        changeStatus()({ actor: actorNamed('worker'), id: row.id, input: { to: 'IN_PROGRESS' } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('409 con los estados en español si la transición no existe (también para quien no podría hacerla)', async () => {
      const row = logIncident('REJECTED');

      for (const who of ['admin', 'director'] as const) {
        const error = await changeStatus()({
          actor: actorNamed(who),
          id: row.id,
          input: { to: 'IN_PROGRESS' },
        }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictError);
        expect(error).toMatchObject({ message: 'No se puede pasar de Rechazada a En curso.' });
      }
    });

    it('409 si se pide el mismo estado', async () => {
      const row = logIncident('OPEN');
      await expect(
        changeStatus()({ actor: actorNamed('admin'), id: row.id, input: { to: 'OPEN' } }),
      ).rejects.toThrow('No se puede pasar de Abierta a Abierta.');
    });

    it.each([
      ['Dirección, una operativa', 'director', 'OPEN', 'IN_PROGRESS'],
      [
        'Dirección, una de gestión (antes que el 400 del comentario)',
        'director',
        'OPEN',
        'REJECTED',
      ],
      ['el Usuario creador, una de gestión', 'worker', 'OPEN', 'REJECTED'],
      ['el Usuario creador, cerrar', 'worker', 'RESOLVED', 'CLOSED'],
      [
        'un Usuario del dpto. que no la creó ni la tiene asignada',
        'demoUser',
        'OPEN',
        'IN_PROGRESS',
      ],
    ] as const)('403 para %s', async (_case, who, from, to) => {
      const row = logIncident(from);

      await expect(
        changeStatus()({ actor: actorNamed(who), id: row.id, input: { to } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(world.incidentEvents.events).toEqual([]);
    });

    it('nota ²: el Responsable fuera de sus dptos. hace la operativa de la que tiene asignada, pero no la de gestión', async () => {
      const row = world.incidents.add({
        departmentId: DEPARTMENTS.CAL.id,
        createdById: admin.id,
        assignedToId: manager.id,
        status: 'OPEN',
      });

      await expect(
        changeStatus()({
          actor: actorNamed('manager'),
          id: row.id,
          input: { to: 'REJECTED', comment: 'No procede.' },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const incident = await changeStatus()({
        actor: actorNamed('manager'),
        id: row.id,
        input: { to: 'IN_PROGRESS' },
      });
      expect(incident.status).toBe('IN_PROGRESS');
    });

    it('el Usuario asignado (no creador) hace las operativas', async () => {
      const row = world.incidents.add({
        departmentId: DEPARTMENTS.LOG.id,
        createdById: manager.id,
        assignedToId: INCIDENT_USERS.demoUser.id,
        status: 'IN_PROGRESS',
      });

      const incident = await changeStatus()({
        actor: actorNamed('demoUser'),
        id: row.id,
        input: { to: 'RESOLVED', comment: 'Hecho.' },
      });
      expect(incident.status).toBe('RESOLVED');
    });

    it.each([
      ['OPEN', 'REJECTED'],
      ['IN_PROGRESS', 'RESOLVED'],
      ['RESOLVED', 'IN_PROGRESS'],
      ['CLOSED', 'REOPENED'],
    ] as const)('400 si %s → %s no trae comentario', async (from, to) => {
      const row = logIncident(from);

      const error = await changeStatus()({
        actor: actorNamed('manager'),
        id: row.id,
        input: { to },
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({
        message: COMMENT_REQUIRED,
        details: [{ path: 'comment', message: COMMENT_REQUIRED }],
      });
      expect(world.incidents.rows[0]?.status).toBe(from);
      expect(world.incidentEvents.events).toEqual([]);
    });
  });
});
