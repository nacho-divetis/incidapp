import { Status } from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import { STATUS_LABELS } from './status-labels';

describe('STATUS_LABELS', () => {
  it('CA-04.3: un nombre en español por estado, el de docs/glosario.md', () => {
    expect(Object.keys(STATUS_LABELS)).toEqual(Status.options);
    expect(Object.values(STATUS_LABELS)).toEqual([
      'Abierta',
      'En curso',
      'Pendiente de tercero',
      'Resuelta',
      'Cerrada',
      'Rechazada',
      'Reabierta',
    ]);
  });
});
