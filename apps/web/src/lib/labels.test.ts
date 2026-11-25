// CA-01.15 (rol en español) · Textos de los roles según `docs/glosario.md`.
import { IncidentChangedField, Role, type IncidentEvent, type Status } from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import { describeEvent, EVENT_FIELD_LABELS, ROLE_LABELS, transitionLabel } from './labels';

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

// CA-04.8 (texto de los botones de transición, decisión 7 de la spec de F04).
describe('transitionLabel', () => {
  it.each<[Status, Status, string]>([
    ['OPEN', 'IN_PROGRESS', 'Empezar'],
    ['OPEN', 'REJECTED', 'Rechazar'],
    ['IN_PROGRESS', 'PENDING_THIRD_PARTY', 'Pendiente de tercero'],
    ['PENDING_THIRD_PARTY', 'IN_PROGRESS', 'Reanudar'],
    ['IN_PROGRESS', 'RESOLVED', 'Marcar como resuelta'],
    ['RESOLVED', 'IN_PROGRESS', 'Devolver a en curso'],
    ['RESOLVED', 'CLOSED', 'Cerrar'],
    ['CLOSED', 'REOPENED', 'Reabrir'],
    ['REOPENED', 'IN_PROGRESS', 'Empezar'],
  ])('CA-04.8: %s → %s se llama "%s"', (from, to, label) => {
    expect(transitionLabel(from, to)).toBe(label);
  });

  it('una transición sin texto propio se nombra por su estado de destino', () => {
    expect(transitionLabel('OPEN', 'CLOSED')).toBe('Pasar a Cerrada');
  });
});

describe('EVENT_FIELD_LABELS', () => {
  it('cubre exactamente los campos editables del contrato de shared', () => {
    expect(Object.keys(EVENT_FIELD_LABELS).sort()).toEqual(
      [...IncidentChangedField.options].sort(),
    );
  });
});

// CA-04.9 (frase en español de cada evento de la línea de tiempo).
describe('describeEvent', () => {
  const base = {
    id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
    actor: { id: '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c', name: 'Ana Ruiz' },
    createdAt: '2026-11-20T09:15:00.000Z',
  };
  const PABLO = { id: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d', name: 'Pablo Sanz' };
  const ELENA = { id: '8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d1e', name: 'Elena Mora' };

  it.each<[string, IncidentEvent, string]>([
    ['CREATED', { ...base, type: 'CREATED', data: {} }, 'creó la incidencia'],
    [
      'STATUS_CHANGED',
      { ...base, type: 'STATUS_CHANGED', data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null } },
      'cambió el estado de Abierta a En curso',
    ],
    [
      'ASSIGNED sin asignado anterior',
      { ...base, type: 'ASSIGNED', data: { from: null, to: PABLO } },
      'asignó a Pablo Sanz',
    ],
    [
      'ASSIGNED con asignado anterior',
      { ...base, type: 'ASSIGNED', data: { from: PABLO, to: ELENA } },
      'asignó a Elena Mora (antes, a Pablo Sanz)',
    ],
    [
      'UPDATED',
      {
        ...base,
        type: 'UPDATED',
        data: {
          changes: [
            { field: 'title', before: 'Fallo', after: 'Fallo en la carretilla 3' },
            { field: 'priority', before: 'LOW', after: 'HIGH' },
          ],
        },
      },
      'editó: título, prioridad',
    ],
    [
      'UPDATED de la fecha objetivo y la descripción',
      {
        ...base,
        type: 'UPDATED',
        data: {
          changes: [
            { field: 'dueDate', before: null, after: '2026-12-01' },
            { field: 'description', before: 'a', after: 'b' },
          ],
        },
      },
      'editó: fecha objetivo, descripción',
    ],
  ])('CA-04.9: %s', (_case, event, phrase) => {
    expect(describeEvent(event)).toBe(phrase);
  });
});
