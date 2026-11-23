// CA-00.19 · Checkbox: se marca con el ratón (también pulsando su texto) y con el teclado.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('CA-00.19: con label, pulsar el texto marca la casilla y avisa con onChange', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Recordar mi sesión" onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Recordar mi sesión' });
    await userEvent.click(screen.getByText('Recordar mi sesión'));

    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('CA-00.19: se marca con la barra espaciadora tras llegar con el tabulador', async () => {
    render(<Checkbox aria-label="Seleccionar fila" />);

    await userEvent.tab();
    await userEvent.keyboard(' ');

    const checkbox = screen.getByRole('checkbox', { name: 'Seleccionar fila' });
    expect(checkbox).toHaveFocus();
    expect(checkbox).toBeChecked();
  });

  it('CA-00.19: deshabilitada no cambia ni avisa', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Recordar mi sesión" disabled onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Recordar mi sesión' });
    await userEvent.click(checkbox);

    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('CA-00.19: con invalid expone aria-invalid', () => {
    render(<Checkbox label="Acepto las condiciones" invalid />);
    expect(screen.getByRole('checkbox', { name: 'Acepto las condiciones' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
