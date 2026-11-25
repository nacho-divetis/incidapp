import { describe, expect, it } from 'vitest';
import { Status } from './index';

describe('Status', () => {
  it('define los siete estados del glosario, empezando por OPEN', () => {
    expect(Status.options).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'PENDING_THIRD_PARTY',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'REOPENED',
    ]);
  });

  it('rechaza un estado desconocido', () => {
    expect(Status.safeParse('DONE').success).toBe(false);
  });
});
