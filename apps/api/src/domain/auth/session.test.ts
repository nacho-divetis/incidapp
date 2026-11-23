import { describe, expect, it } from 'vitest';
import { isSessionExpired, SESSION_TTL_MS, sessionExpiresAt } from './session';

const T0 = new Date('2026-11-23T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('sesión', () => {
  it('CA-01.6: la sesión dura 7 días fijos desde el login', () => {
    expect(SESSION_TTL_MS).toBe(7 * DAY_MS);
    expect(sessionExpiresAt(T0)).toEqual(new Date(T0.getTime() + 7 * DAY_MS));
  });

  it.each([
    ['justo después de crearla', 1, false],
    ['un milisegundo antes de caducar', SESSION_TTL_MS - 1, false],
    ['en el instante de caducidad', SESSION_TTL_MS, true],
    ['después de t + la duración', SESSION_TTL_MS + 1, true],
  ])('CA-01.6: %s → caducada = %s', (_case, elapsedMs, expired) => {
    const expiresAt = sessionExpiresAt(T0);
    const now = new Date(T0.getTime() + elapsedMs);

    expect(isSessionExpired(expiresAt, now)).toBe(expired);
  });
});
