// CA-00.19 · Label: se asocia a su campo por `htmlFor` y marca los obligatorios de forma accesible.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Label } from './Label';

describe('Label', () => {
  it('CA-00.19: con htmlFor da nombre al campo y pulsarla le lleva el foco', async () => {
    render(
      <>
        <Label htmlFor="correo">Correo electrónico</Label>
        <input id="correo" />
      </>,
    );

    const input = screen.getByRole('textbox', { name: 'Correo electrónico' });
    await userEvent.click(screen.getByText('Correo electrónico'));

    expect(input).toHaveFocus();
  });

  it('CA-00.19: con required muestra el asterisco y anuncia "obligatorio" en su lugar', () => {
    render(
      <>
        <Label htmlFor="titulo" required>
          Título
        </Label>
        <input id="titulo" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Título (obligatorio)' })).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('CA-00.19: el texto accesible de obligatorio se puede cambiar por props', () => {
    render(
      <>
        <Label htmlFor="titulo" required requiredText="requerido">
          Título
        </Label>
        <input id="titulo" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Título (requerido)' })).toBeInTheDocument();
  });
});
