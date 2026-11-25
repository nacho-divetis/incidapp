// CA-03.12 y CA-03.14 · PriorityBadge: la prioridad se muestra en español.
import { Priority } from '@incidapp/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRIORITY_LABELS } from '@/lib/labels';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  it.each(Priority.options)('muestra la prioridad %s en español', (priority) => {
    render(<PriorityBadge priority={priority} />);

    expect(screen.getByText(PRIORITY_LABELS[priority])).toBeInTheDocument();
  });

  it('las cuatro prioridades tienen tonos distintos', () => {
    render(
      <>
        {Priority.options.map((priority) => (
          <PriorityBadge key={priority} priority={priority} />
        ))}
      </>,
    );

    const classes = Priority.options.map(
      (priority) => screen.getByText(PRIORITY_LABELS[priority]).className,
    );
    expect(new Set(classes).size).toBe(Priority.options.length);
  });
});
