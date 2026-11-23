// CA-00.19 · Input: `invalid` → `aria-invalid`, acepta `aria-describedby`, reenvía `ref` y se escribe.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('CA-00.19: sin invalid no expone aria-invalid', () => {
    render(<Input aria-label="Título" />);
    expect(screen.getByRole('textbox', { name: 'Título' })).not.toHaveAttribute('aria-invalid');
  });

  it('CA-00.19: con invalid expone aria-invalid y se asocia a su mensaje con aria-describedby', () => {
    render(
      <>
        <Input aria-label="Título" invalid aria-describedby="titulo-error" />
        <p id="titulo-error">El título es obligatorio</p>
      </>,
    );

    const input = screen.getByRole('textbox', { name: 'Título' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('El título es obligatorio');
  });

  it('CA-00.19: se escribe en él, recibe el foco con el teclado y reenvía ref', async () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Título" ref={ref} />);

    await userEvent.tab();
    await userEvent.keyboard('Pantalla rota');

    const input = screen.getByRole('textbox', { name: 'Título' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Pantalla rota');
    expect(ref.current).toBe(input);
  });

  it('CA-00.19: deshabilitado no admite escritura', async () => {
    render(<Input aria-label="Título" disabled />);

    const input = screen.getByRole('textbox', { name: 'Título' });
    await userEvent.type(input, 'algo');

    expect(input).toBeDisabled();
    expect(input).toHaveValue('');
  });
});
