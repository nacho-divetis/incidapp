// CA-01.15 (rol en español) · Textos de los roles según `docs/glosario.md`.
import { Role } from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import { ROLE_LABELS } from './labels';

describe('ROLE_LABELS', () => {
  it('CA-01.15: cada rol tiene su nombre en español', () => {
    expect(ROLE_LABELS).toEqual({
      ADMIN: 'Admin',
      DIRECTOR: 'Dirección',
      MANAGER: 'Responsable',
      USER: 'Usuario',
    });
  });

  it('cubre exactamente los roles del contrato de shared', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...Role.options].sort());
  });
});
