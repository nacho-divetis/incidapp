// CA-04.9 (línea de tiempo) · IncidentTimeline: lista ordenada con autor, fecha y hora en
// `Europe/Madrid`, la frase en español de cada evento y el comentario de los cambios de estado.
import type { IncidentEvent } from '@incidapp/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IncidentTimeline } from './IncidentTimeline';

const ANA = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01', name: 'Ana Ruiz' };
const PABLO = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02', name: 'Pablo Sanz' };

const EVENTS: IncidentEvent[] = [
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01',
    type: 'CREATED',
    actor: ANA,
    createdAt: '2026-11-20T08:05:00.000Z',
    data: {},
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02',
    type: 'UPDATED',
    actor: ANA,
    createdAt: '2026-11-20T08:30:00.000Z',
    data: {
      changes: [
        { field: 'title', before: 'Lector roto', after: 'Lector de códigos sin batería' },
        { field: 'priority', before: 'LOW', after: 'HIGH' },
      ],
    },
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d03',
    type: 'ASSIGNED',
    actor: ANA,
    createdAt: '2026-11-20T09:00:00.000Z',
    data: { from: null, to: PABLO },
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d04',
    type: 'STATUS_CHANGED',
    actor: PABLO,
    createdAt: '2026-11-20T10:00:00.000Z',
    data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d05',
    type: 'STATUS_CHANGED',
    actor: PABLO,
    // 23:30 UTC del 30/11 → 00:30 del 01/12 en Madrid.
    createdAt: '2026-11-30T23:30:00.000Z',
    data: {
      from: 'IN_PROGRESS',
      to: 'RESOLVED',
      comment: 'Cambiada la batería.\nProbado en el muelle 2.',
    },
  },
];

describe('IncidentTimeline', () => {
  it('CA-04.9: es una lista ordenada con un elemento por evento, en el orden recibido', () => {
    render(<IncidentTimeline events={EVENTS} />);

    const list = screen.getByRole('list', { name: 'Historial de la incidencia' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(EVENTS.length);
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Ana Ruiz creó la incidencia',
      'Ana Ruiz editó: título, prioridad',
      'Ana Ruiz asignó a Pablo Sanz',
      'Pablo Sanz cambió el estado de Abierta a En curso',
      'Pablo Sanz cambió el estado de En curso a Resuelta',
    ]);
  });

  it('CA-04.9: muestra la fecha y hora en Europe/Madrid (dd/mm/aaaa HH:mm) en un <time>', () => {
    render(<IncidentTimeline events={EVENTS} />);

    const items = screen.getAllByRole('listitem');
    const first = items[0]?.querySelector('time');
    expect(first).toHaveTextContent('20/11/2026 09:05');
    expect(first).toHaveAttribute('dateTime', '2026-11-20T08:05:00.000Z');
    expect(items[4]?.querySelector('time')).toHaveTextContent('01/12/2026 00:30');
  });

  it('CA-04.9: el comentario de un cambio de estado se muestra citado, con sus saltos de línea', () => {
    render(<IncidentTimeline events={EVENTS} />);

    const items = screen.getAllByRole('listitem');
    const quote = items[4]?.querySelector('blockquote');
    expect(quote).toHaveTextContent('Comentario: Cambiada la batería. Probado en el muelle 2.');
    expect(quote?.textContent).toContain('Cambiada la batería.\nProbado en el muelle 2.');
    // Un cambio de estado sin comentario no deja un bloque vacío.
    expect(items[3]?.querySelector('blockquote')).toBeNull();
  });

  it('sin eventos, lo dice en lugar de pintar una lista vacía', () => {
    render(<IncidentTimeline events={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no hay eventos en el historial.')).toBeInTheDocument();
  });

  it('acepta otro nombre accesible para la lista', () => {
    render(<IncidentTimeline events={EVENTS.slice(0, 1)} label="Historial de INC-2026-0001" />);
    expect(screen.getByRole('list', { name: 'Historial de INC-2026-0001' })).toBeInTheDocument();
  });
});
