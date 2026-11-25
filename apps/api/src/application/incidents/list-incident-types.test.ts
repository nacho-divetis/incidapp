import { describe, expect, it } from 'vitest';
import { makeListIncidentTypes } from './list-incident-types';
import { createIncidentWorld, DEPARTMENTS } from './test-fakes';

describe('listIncidentTypes', () => {
  it('CA-03.1: devuelve el catálogo con su dpto. por defecto, ordenado por nombre', async () => {
    const world = createIncidentWorld();

    const types = await makeListIncidentTypes({ incidentTypes: world.incidentTypes })();

    expect(types.map((type) => [type.name, type.department.code])).toEqual([
      ['Administrativa', 'ADM'],
      ['Calidad', 'CAL'],
      ['Transporte', 'LOG'],
    ]);
    expect(types[0]?.department).toEqual(DEPARTMENTS.ADM);
  });
});
