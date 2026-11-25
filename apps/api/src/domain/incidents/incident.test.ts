import { Priority, Status } from '@incidapp/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  type IncidentPriority,
  type IncidentStatus,
} from './incident';

describe('IncidentStatus', () => {
  it('coincide con el enum Status del contrato compartido', () => {
    expectTypeOf<IncidentStatus>().toEqualTypeOf<Status>();
  });

  it('INCIDENT_STATUSES enumera los 7 estados en el orden del contrato', () => {
    expect(INCIDENT_STATUSES).toEqual(Status.options);
  });
});

describe('IncidentPriority', () => {
  it('coincide con el enum Priority del contrato compartido', () => {
    expectTypeOf<IncidentPriority>().toEqualTypeOf<Priority>();
  });

  it('INCIDENT_PRIORITIES enumera las 4 prioridades en el orden del contrato', () => {
    expect(INCIDENT_PRIORITIES).toEqual(Priority.options);
  });
});
