// CA-01.13 (campos) · FormField: etiqueta asociada al campo y, con error, `aria-invalid` y el mensaje
// enlazado con `aria-describedby`, generando los ids a partir de `htmlFor`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input, Select } from '../../atoms';
import { FormField } from './FormField';

describe('FormField', () => {
  it('CA-01.13: la etiqueta da nombre al campo y sin error no hay aria-invalid ni descripción', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('id', 'email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('CA-01.13: con error, el campo tiene aria-invalid y el mensaje como descripción accesible', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Introduce un email válido.">
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(input).toHaveAccessibleDescription('Introduce un email válido.');
    // El átomo recibe `invalid`: borde de error.
    expect(input).toHaveClass('border-danger');
  });

  it('CA-01.13: la ayuda también describe el campo, con el error delante', () => {
    render(
      <FormField
        label="Contraseña"
        htmlFor="password"
        hint="Distingue mayúsculas y minúsculas."
        error="Introduce la contraseña."
      >
        <Input type="password" />
      </FormField>,
    );

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('aria-describedby', 'password-error password-hint');
    expect(input).toHaveAccessibleDescription(
      'Introduce la contraseña. Distingue mayúsculas y minúsculas.',
    );
  });

  it('conserva el aria-describedby que ya tuviera el campo', () => {
    render(
      <>
        <FormField label="Título" htmlFor="title" hint="Máximo 120 caracteres.">
          <Input aria-describedby="title-counter" />
        </FormField>
        <p id="title-counter">0/120</p>
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveAttribute(
      'aria-describedby',
      'title-hint title-counter',
    );
  });

  it('con required, la etiqueta lo indica y el campo tiene aria-required', () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email (obligatorio)' });
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('un error vacío no marca el campo como no válido', () => {
    render(
      <FormField label="Email" htmlFor="email" error="">
        <Input type="email" />
      </FormField>,
    );
    expect(screen.getByRole('textbox', { name: 'Email' })).not.toHaveAttribute('aria-invalid');
  });

  it('a un elemento nativo solo le pasa los atributos aria, sin la prop invalid', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Obligatorio.">
        <input type="email" />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toHaveAttribute('invalid');
  });

  it('funciona con otros campos (Select) y al pulsar la etiqueta se enfoca el campo', async () => {
    render(
      <FormField label="Prioridad" htmlFor="priority" error="Elige una prioridad.">
        <Select defaultValue="">
          <option value="">Selecciona…</option>
          <option value="HIGH">Alta</option>
        </Select>
      </FormField>,
    );

    await userEvent.click(screen.getByText('Prioridad'));
    const select = screen.getByRole('combobox', { name: 'Prioridad' });
    expect(select).toHaveFocus();
    expect(select).toHaveAccessibleDescription('Elige una prioridad.');
  });
});
