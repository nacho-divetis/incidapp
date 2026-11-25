import { IncidentListQuery, IncidentListResponse, INCIDENTS_PAGE_SIZE } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { actorOf, canOnIncident } from '../authorization/authorization-policy';
import { makeListIncidents } from './list-incidents';
import {
  actorNamed,
  createIncidentWorld,
  DEPARTMENTS,
  factsOf,
  INCIDENT_USERS,
  type IncidentWorld,
} from './test-fakes';

let world: IncidentWorld;

beforeEach(() => {
  world = createIncidentWorld();
});

const listIncidents = () => makeListIncidents({ incidents: world.incidents });
const query = (raw: Record<string, string> = {}) => IncidentListQuery.parse(raw);
const { worker, manager, admin, demoUser } = INCIDENT_USERS;

/** Incidencias de varios dptos., creadas por y asignadas a distintos usuarios. */
function seedVariety() {
  return [
    world.incidents.add({ departmentId: DEPARTMENTS.LOG.id, createdById: admin.id }),
    world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: worker.id }),
    world.incidents.add({
      departmentId: DEPARTMENTS.ADM.id,
      createdById: admin.id,
      assignedToId: manager.id,
    }),
    world.incidents.add({ departmentId: DEPARTMENTS.CAL.id, createdById: admin.id }),
    world.incidents.add({
      departmentId: DEPARTMENTS.ADM.id,
      createdById: admin.id,
      assignedToId: demoUser.id,
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      title: 'Error en la factura de noviembre',
    }),
  ];
}

describe('listIncidents', () => {
  it.each(['admin', 'director', 'manager', 'worker', 'demoUser'] as const)(
    'CA-03.7: %s recibe solo las visibles según canOnIncident y total las cuenta',
    async (who) => {
      const rows = seedVariety();
      const actor = actorNamed(who);
      const visible = rows.filter((row) => canOnIncident(actorOf(actor), factsOf(row), 'view'));

      const result = await listIncidents()(actor, query());

      expect(result.items.map((item) => item.id).sort()).toEqual(visible.map((r) => r.id).sort());
      expect(result.total).toBe(visible.length);
    },
  );

  it('CA-03.7: Admin ve todas, de la más reciente a la más antigua, con la forma del contrato', async () => {
    const rows = seedVariety();

    const result = await listIncidents()(actorNamed('admin'), query());

    expect(result.items.map((item) => item.id)).toEqual(rows.map((r) => r.id).reverse());
    expect(result).toMatchObject({ total: 5, page: 1, pageSize: INCIDENTS_PAGE_SIZE });
    expect(() => IncidentListResponse.parse(result)).not.toThrow();
    expect(result.items[0]).not.toHaveProperty('allowedActions');
    expect(result.items[0]).not.toHaveProperty('description');
  });

  it('CA-03.7: pagina de 20 en 20', async () => {
    for (let i = 0; i < 25; i += 1) {
      world.incidents.add({ departmentId: DEPARTMENTS.LOG.id, createdById: admin.id });
    }

    const first = await listIncidents()(actorNamed('admin'), query());
    const second = await listIncidents()(actorNamed('admin'), query({ page: '2' }));

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(second).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    expect(second.items.at(-1)?.code).toBe('INC-2026-0001');
  });

  it('CA-03.8: filtra por estado, prioridad y dpto., combinados con Y', async () => {
    seedVariety();
    const list = listIncidents();
    const admin = actorNamed('admin');

    expect((await list(admin, query({ status: 'IN_PROGRESS' }))).total).toBe(1);
    expect((await list(admin, query({ priority: 'MEDIUM' }))).total).toBe(4);
    expect((await list(admin, query({ departmentId: DEPARTMENTS.CAL.id }))).total).toBe(2);
    expect(
      (await list(admin, query({ departmentId: DEPARTMENTS.ADM.id, priority: 'URGENT' }))).total,
    ).toBe(1);
    expect((await list(admin, query({ status: 'CLOSED', priority: 'URGENT' }))).total).toBe(0);
  });

  it('CA-03.8: filtrar por un dpto. ajeno no amplía lo visible', async () => {
    seedVariety();

    const result = await listIncidents()(
      actorNamed('worker'),
      query({ departmentId: DEPARTMENTS.CAL.id }),
    );

    // De CAL, la trabajadora solo ve la que ha creado (la segunda del *seed*).
    expect(result.items.map((item) => item.code)).toEqual(['INC-2026-0002']);
    expect(result.total).toBe(1);
  });

  it('CA-03.8: "Asignadas a mí" usa el id del actor', async () => {
    seedVariety();

    const result = await listIncidents()(actorNamed('manager'), query({ assignedToMe: 'true' }));

    expect(result.items.map((item) => item.assignee?.id)).toEqual([manager.id]);
  });

  it('CA-03.8: q busca sin distinguir mayúsculas en el código y el título', async () => {
    seedVariety();
    const list = listIncidents();

    expect((await list(actorNamed('admin'), query({ q: 'FACTURA' }))).total).toBe(1);
    expect((await list(actorNamed('admin'), query({ q: 'inc-2026-0002' }))).total).toBe(1);
    expect((await list(actorNamed('admin'), query({ q: 'nada que ver' }))).total).toBe(0);
  });
});
