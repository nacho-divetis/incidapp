// CA-03.12 y CA-03.14 · StatusBadge: el estado se muestra en español.
import { Status } from '@incidapp/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_LABELS } from '@/lib/labels';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each(Status.options)('muestra el estado %s en español', (status) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('cada estado de cierre tiene un tono distinto del de una abierta', () => {
    render(
      <>
        <StatusBadge status="OPEN" />
        <StatusBadge status="RESOLVED" />
        <StatusBadge status="REJECTED" />
      </>,
    );

    const classes = ['Abierta', 'Resuelta', 'Rechazada'].map(
      (text) => screen.getByText(text).className,
    );
    expect(new Set(classes).size).toBe(3);
  });
});
