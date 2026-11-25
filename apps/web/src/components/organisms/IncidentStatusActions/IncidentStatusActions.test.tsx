// CA-04.8 (botones de transición) · IncidentStatusActions: un botón por cada transición de
// `allowedTransitions`, con su texto en español, y ninguno si la lista está vacía.
import type { AllowedTransition } from '@incidapp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IncidentStatusActions } from './IncidentStatusActions';

const FROM_OPEN: AllowedTransition[] = [
  { to: 'IN_PROGRESS', requiresComment: false },
  { to: 'REJECTED', requiresComment: true },
];

const buttonTexts = () => screen.getAllByRole('button').map((button) => button.textContent);

describe('IncidentStatusActions', () => {
  it('CA-04.8: pinta un botón por transición, con el texto según el origen y el destino', () => {
    render(<IncidentStatusActions status="OPEN" transitions={FROM_OPEN} onSelect={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Cambiar el estado' });
    expect(group.querySelectorAll('button')).toHaveLength(2);
    expect(buttonTexts()).toEqual(['Empezar', 'Rechazar']);
  });

  it('CA-04.8: con la lista vacía no pinta ningún botón', () => {
    const { container } = render(
      <IncidentStatusActions status="REJECTED" transitions={[]} onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('CA-04.8: solo salen las transiciones recibidas (no deduce otras del estado)', () => {
    render(
      <IncidentStatusActions
        status="RESOLVED"
        transitions={[{ to: 'CLOSED', requiresComment: false }]}
        onSelect={vi.fn()}
      />,
    );
    expect(buttonTexts()).toEqual(['Cerrar']);
  });

  it('CA-04.8: el texto depende del origen (PENDIENTE DE TERCERO → EN CURSO es "Reanudar")', () => {
    render(
      <IncidentStatusActions
        status="PENDING_THIRD_PARTY"
        transitions={[{ to: 'IN_PROGRESS', requiresComment: false }]}
        onSelect={vi.fn()}
      />,
    );
    expect(buttonTexts()).toEqual(['Reanudar']);
  });

  it('CA-04.8: pulsar un botón llama a onSelect con su transición', async () => {
    const onSelect = vi.fn();
    render(<IncidentStatusActions status="OPEN" transitions={FROM_OPEN} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ to: 'REJECTED', requiresComment: true });
  });

  it('"Rechazar" es un botón de peligro y los demás, secundarios', () => {
    render(<IncidentStatusActions status="OPEN" transitions={FROM_OPEN} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Rechazar' })).toHaveClass('bg-danger');
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveClass('bg-surface');
  });

  it('disabled: deshabilita todos los botones', async () => {
    const onSelect = vi.fn();
    render(
      <IncidentStatusActions status="OPEN" transitions={FROM_OPEN} onSelect={onSelect} disabled />,
    );
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
