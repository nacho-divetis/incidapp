import { Status } from '@incidapp/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { INCIDENT_STATUSES, type IncidentStatus } from './incident';

describe('IncidentStatus', () => {
  it('coincide con el enum Status del contrato compartido', () => {
    expectTypeOf<IncidentStatus>().toEqualTypeOf<Status>();
  });

  it('INCIDENT_STATUSES enumera los 7 estados en el orden del contrato', () => {
    expect(INCIDENT_STATUSES).toEqual(Status.options);
  });
});
