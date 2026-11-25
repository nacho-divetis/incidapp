// RNF-14 · CA-03.12 y CA-03.14 (fechas en `dd/mm/aaaa`, zona `Europe/Madrid`): las fechas sin hora no
// se desplazan y las marcas de tiempo cambian de día según la hora de Madrid, no la de UTC.
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './dates';

describe('formatDate', () => {
  it('una fecha AAAA-MM-DD se muestra tal cual, sin pasar por ninguna zona', () => {
    expect(formatDate('2026-11-30')).toBe('30/11/2026');
    expect(formatDate('2027-01-01')).toBe('01/01/2027');
  });

  it('una marca de tiempo se muestra con el día de Madrid', () => {
    expect(formatDate('2026-11-25T10:00:00.000Z')).toBe('25/11/2026');
  });

  it('las 23:30 UTC del 31/12 ya son el 01/01 en Madrid (invierno, UTC+1)', () => {
    expect(formatDate('2026-12-31T23:30:00.000Z')).toBe('01/01/2027');
  });

  it('las 22:30 UTC del 30/06 ya son el 01/07 en Madrid (verano, UTC+2)', () => {
    expect(formatDate('2026-06-30T22:30:00.000Z')).toBe('01/07/2026');
  });

  it('las 22:59 UTC del 31/12 todavía son el 31/12 en Madrid', () => {
    expect(formatDate('2026-12-31T22:59:00.000Z')).toBe('31/12/2026');
  });

  it('rechaza un texto que no es una fecha', () => {
    expect(() => formatDate('mañana')).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('muestra la fecha y la hora de Madrid con 24 horas', () => {
    expect(formatDateTime('2026-11-25T08:05:00.000Z')).toBe('25/11/2026 09:05');
    expect(formatDateTime('2026-11-25T16:45:00.000Z')).toBe('25/11/2026 17:45');
  });

  it('cambia de día con la hora de Madrid', () => {
    expect(formatDateTime('2026-12-31T23:30:00.000Z')).toBe('01/01/2027 00:30');
  });

  it('respeta el horario de verano', () => {
    expect(formatDateTime('2026-07-15T10:00:00.000Z')).toBe('15/07/2026 12:00');
  });
});
