import { describe, expect, it } from 'vitest';
import { formatIncidentCode, incidentYear } from './incident-code';

describe('incidentYear (año del código en Europe/Madrid, decisión 5 de F03)', () => {
  it.each([
    ['2026-06-15T10:00:00.000Z', 2026],
    // 31/12 a las 23:30 UTC ya es 1 de enero en Madrid (UTC+1 en invierno).
    ['2026-12-31T23:30:00.000Z', 2027],
    ['2026-12-31T22:59:59.999Z', 2026],
    ['2026-12-31T23:00:00.000Z', 2027],
    ['2027-01-01T00:30:00.000Z', 2027],
  ])('CA-03.4: %s → %i', (iso, year) => {
    expect(incidentYear(new Date(iso))).toBe(year);
  });
});

describe('formatIncidentCode', () => {
  it.each([
    [2026, 1, 'INC-2026-0001'],
    [2026, 42, 'INC-2026-0042'],
    [2027, 9999, 'INC-2027-9999'],
    // Más de 9999 en un año no se trunca: el contrato admite 4 cifras como mínimo.
    [2027, 12345, 'INC-2027-12345'],
  ])('CA-03.4: (%i, %i) → %s', (year, n, code) => {
    expect(formatIncidentCode(year, n)).toBe(code);
  });

  it('rechaza un número que no es un entero positivo', () => {
    expect(() => formatIncidentCode(2026, 0)).toThrow();
    expect(() => formatIncidentCode(2026, 1.5)).toThrow();
  });
});
