import type { IncidentFieldChange } from '@incidapp/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { diffIncidentFields, type IncidentEditableFields } from './incident-changes';

const BEFORE: IncidentEditableFields = {
  title: 'Retraso en la entrega',
  description: 'El transportista no ha llegado.',
  priority: 'MEDIUM',
  dueDate: '2026-12-01',
};

describe('diffIncidentFields (CA-03.9)', () => {
  it('devuelve solo los campos que cambian, con su valor anterior y el nuevo, en orden fijo', () => {
    expect(
      diffIncidentFields(BEFORE, {
        priority: 'HIGH',
        title: 'Retraso grave en la entrega',
        description: BEFORE.description,
      }),
    ).toEqual([
      { field: 'title', before: 'Retraso en la entrega', after: 'Retraso grave en la entrega' },
      { field: 'priority', before: 'MEDIUM', after: 'HIGH' },
    ]);
  });

  it('dueDate: null quita la fecha y una fecha nueva la pone', () => {
    expect(diffIncidentFields(BEFORE, { dueDate: null })).toEqual([
      { field: 'dueDate', before: '2026-12-01', after: null },
    ]);
    expect(diffIncidentFields({ ...BEFORE, dueDate: null }, { dueDate: '2026-12-24' })).toEqual([
      { field: 'dueDate', before: null, after: '2026-12-24' },
    ]);
  });

  it('un campo ausente (undefined) no cambia; si nada cambia, la lista está vacía', () => {
    expect(diffIncidentFields(BEFORE, {})).toEqual([]);
    expect(diffIncidentFields(BEFORE, { ...BEFORE })).toEqual([]);
    expect(diffIncidentFields({ ...BEFORE, dueDate: null }, { dueDate: null })).toEqual([]);
  });

  it('cada cambio tiene la forma del contrato (IncidentFieldChange)', () => {
    expectTypeOf(diffIncidentFields(BEFORE, {})).toExtend<IncidentFieldChange[]>();
  });
});
