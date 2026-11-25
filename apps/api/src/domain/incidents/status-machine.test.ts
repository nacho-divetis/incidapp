import { describe, expect, it } from 'vitest';
import { INCIDENT_STATUSES, type IncidentStatus } from './incident';
import {
  findTransition,
  InvalidTransitionError,
  STATUS_TRANSITIONS,
  type StatusTransition,
  transitionsFrom,
} from './status-machine';

type Expected = Pick<StatusTransition, 'kind' | 'requiresComment'>;

/**
 * Tabla "Transiciones de estado" de `docs/permisos.md`, fila a fila (en el mismo orden). Es la
 * única fuente del test: cualquier par que no esté aquí debe rechazarse.
 */
const PERMISOS_TABLE: [IncidentStatus, IncidentStatus, Expected, string][] = [
  ['OPEN', 'IN_PROGRESS', { kind: 'operational', requiresComment: false }, 'ABIERTA → EN CURSO'],
  ['OPEN', 'REJECTED', { kind: 'management', requiresComment: true }, 'ABIERTA → RECHAZADA'],
  [
    'IN_PROGRESS',
    'PENDING_THIRD_PARTY',
    { kind: 'operational', requiresComment: false },
    'EN CURSO → PENDIENTE DE TERCERO',
  ],
  [
    'PENDING_THIRD_PARTY',
    'IN_PROGRESS',
    { kind: 'operational', requiresComment: false },
    'PENDIENTE DE TERCERO → EN CURSO',
  ],
  [
    'IN_PROGRESS',
    'RESOLVED',
    { kind: 'operational', requiresComment: true },
    'EN CURSO → RESUELTA',
  ],
  [
    'RESOLVED',
    'IN_PROGRESS',
    { kind: 'management', requiresComment: true },
    'RESUELTA → EN CURSO (solución no válida)',
  ],
  ['RESOLVED', 'CLOSED', { kind: 'management', requiresComment: false }, 'RESUELTA → CERRADA'],
  ['CLOSED', 'REOPENED', { kind: 'management', requiresComment: true }, 'CERRADA → REABIERTA'],
  [
    'REOPENED',
    'IN_PROGRESS',
    { kind: 'operational', requiresComment: false },
    'REABIERTA → EN CURSO',
  ],
];

function expectedFor(from: IncidentStatus, to: IncidentStatus): Expected | undefined {
  return PERMISOS_TABLE.find(([f, t]) => f === from && t === to)?.[2];
}

/** Los 7 × 7 = 49 pares (estado actual, estado destino), con lo que dice `permisos.md` de cada uno. */
const ALL_PAIRS = INCIDENT_STATUSES.flatMap((from) =>
  INCIDENT_STATUSES.map((to) => ({ from, to, expected: expectedFor(from, to) })),
);

describe('máquina de estados', () => {
  it('CA-04.1: se prueban los 49 pares y 9 de ellos son transiciones de permisos.md', () => {
    expect(ALL_PAIRS).toHaveLength(49);
    expect(ALL_PAIRS.filter((pair) => pair.expected)).toHaveLength(9);
  });

  it.each(ALL_PAIRS)('CA-04.1: $from → $to', ({ from, to, expected }) => {
    if (expected) {
      expect(findTransition(from, to)).toEqual({ from, to, ...expected });
    } else {
      expect(() => findTransition(from, to)).toThrow(InvalidTransitionError);
    }
  });

  it.each(PERMISOS_TABLE)(
    'CA-04.1: %s → %s es la fila "%s" de permisos.md',
    (from, to, expected) => {
      expect(findTransition(from, to)).toMatchObject(expected);
    },
  );

  it('CA-04.1: STATUS_TRANSITIONS tiene exactamente las 9 filas de permisos.md', () => {
    expect(STATUS_TRANSITIONS).toEqual(
      PERMISOS_TABLE.map(([from, to, expected]) => ({ from, to, ...expected })),
    );
  });

  it('CA-04.1: no hay ninguna transición desde RECHAZADA (estado final)', () => {
    expect(transitionsFrom('REJECTED')).toEqual([]);
    for (const to of INCIDENT_STATUSES) {
      expect(() => findTransition('REJECTED', to)).toThrow(InvalidTransitionError);
    }
  });

  it('CA-04.1: REABIERTA solo se alcanza desde CERRADA', () => {
    const origins = STATUS_TRANSITIONS.filter((t) => t.to === 'REOPENED').map((t) => t.from);

    expect(origins).toEqual(['CLOSED']);
  });

  it.each(INCIDENT_STATUSES)('CA-04.1: %s no transita a sí mismo', (status) => {
    expect(() => findTransition(status, status)).toThrow(InvalidTransitionError);
  });

  it('CA-04.1: el error de dominio lleva el par rechazado', () => {
    let error: unknown;
    try {
      findTransition('REJECTED', 'IN_PROGRESS');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InvalidTransitionError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'InvalidTransitionError',
      from: 'REJECTED',
      to: 'IN_PROGRESS',
    });
  });

  it.each([
    ['OPEN', ['IN_PROGRESS', 'REJECTED']],
    ['IN_PROGRESS', ['PENDING_THIRD_PARTY', 'RESOLVED']],
    ['PENDING_THIRD_PARTY', ['IN_PROGRESS']],
    ['RESOLVED', ['IN_PROGRESS', 'CLOSED']],
    ['CLOSED', ['REOPENED']],
    ['REJECTED', []],
    ['REOPENED', ['IN_PROGRESS']],
  ] satisfies [IncidentStatus, IncidentStatus[]][])(
    'CA-04.1: transitionsFrom(%s) devuelve las transiciones que salen de ese estado',
    (from, targets) => {
      const transitions = transitionsFrom(from);

      expect(transitions.map((t) => t.to)).toEqual(targets);
      expect(transitions.every((t) => t.from === from)).toBe(true);
    },
  );
});
