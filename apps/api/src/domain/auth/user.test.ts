import type { Role } from '@incidapp/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { normalizeEmail, type UserRole } from './user';

describe('normalizeEmail', () => {
  it.each([
    ['admin@incidapp.test', 'admin@incidapp.test'],
    ['  Admin@IncidApp.TEST  ', 'admin@incidapp.test'],
    ['\tUSUARIO@incidapp.test\n', 'usuario@incidapp.test'],
  ])('CA-01.1: "%s" → "%s" (sin espacios y en minúsculas)', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});

describe('UserRole', () => {
  it('coincide con el enum Role del contrato compartido', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<Role>();
  });
});
