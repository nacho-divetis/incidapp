// CA-00.20 · AuthLayout: panel con el título como h1 y el contenido, dentro de main.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('CA-00.20: pinta el título como h1 y el contenido dentro de main', () => {
    render(
      <AuthLayout title="Iniciar sesión">
        <form aria-label="Acceso">
          <button type="submit">Entrar</button>
        </form>
      </AuthLayout>,
    );

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    expect(within(main).getByRole('form', { name: 'Acceso' })).toBeInTheDocument();
  });
});
