// CA-01.15 (rol en español) · CA-03.12 (estado y prioridad en español) · Textos de los valores del
// dominio según `docs/glosario.md`.
import { Priority, Role, Status } from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from './labels';

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

describe('STATUS_LABELS', () => {
  it('CA-03.12: cada estado tiene su nombre en español', () => {
    expect(STATUS_LABELS).toEqual({
      OPEN: 'Abierta',
      IN_PROGRESS: 'En curso',
      PENDING_THIRD_PARTY: 'Pendiente de tercero',
      RESOLVED: 'Resuelta',
      CLOSED: 'Cerrada',
      REJECTED: 'Rechazada',
      REOPENED: 'Reabierta',
    });
  });

  it('cubre exactamente los estados del contrato de shared', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...Status.options].sort());
  });
});

describe('PRIORITY_LABELS', () => {
  it('CA-03.12: cada prioridad tiene su nombre en español', () => {
    expect(PRIORITY_LABELS).toEqual({
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      URGENT: 'Urgente',
    });
  });

  it('cubre exactamente las prioridades del contrato de shared', () => {
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual([...Priority.options].sort());
  });
});
