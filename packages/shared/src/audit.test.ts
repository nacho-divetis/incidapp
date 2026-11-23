import { describe, expect, it } from 'vitest';
import { AuditAction } from './index';

describe('AuditAction', () => {
  it('CA-01.9: mantiene las acciones de auditoría del inicio de sesión', () => {
    expect(AuditAction.options).toEqual(
      expect.arrayContaining(['LOGIN_SUCCEEDED', 'LOGIN_FAILED']),
    );
  });

  it('CA-02.13: añade las acciones de los cambios de usuarios', () => {
    expect(AuditAction.options).toEqual([
      'LOGIN_SUCCEEDED',
      'LOGIN_FAILED',
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DEACTIVATED',
      'USER_ACTIVATED',
      'USER_PASSWORD_RESET',
    ]);
  });
});
