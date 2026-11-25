import { describe, expect, it } from 'vitest';
import { DEMO_USERS, isDemoUserEmail } from './index';

describe('isDemoUserEmail', () => {
  it.each(DEMO_USERS.map((demo) => [demo.role, demo.email] as const))(
    'CA-02.11: reconoce al usuario demo %s (%s)',
    (_role, email) => {
      expect(isDemoUserEmail(email)).toBe(true);
    },
  );

  it('CA-02.11: reconoce el email demo aunque llegue sin normalizar', () => {
    expect(isDemoUserEmail('  Admin@IncidApp.TEST ')).toBe(true);
  });

  it.each([
    ['un usuario creado por el Admin', 'lucia.gomez@incidapp.test'],
    ['un email parecido de otro dominio', 'admin@incidapp.example'],
    ['un email que contiene uno demo', 'xadmin@incidapp.test'],
    ['el email vacío', ''],
  ])('CA-02.11: no considera demo %s', (_case, email) => {
    expect(isDemoUserEmail(email)).toBe(false);
  });
});
