// CA-01.13 (región de alerta) · Alert: `role="alert"` en danger y warning, `role="status"` en info y
// success, con el título y el mensaje recibidos por props.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('CA-01.13: el tono danger es una región role="alert" con el mensaje', () => {
    render(<Alert tone="danger">Email o contraseña incorrectos.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });

  it.each([
    ['danger', 'alert'],
    ['warning', 'alert'],
    ['info', 'status'],
    ['success', 'status'],
  ] as const)('CA-01.13: el tono %s usa role="%s"', (tone, role) => {
    render(<Alert tone={tone}>Mensaje</Alert>);
    expect(screen.getByRole(role)).toHaveTextContent('Mensaje');
  });

  it('sin tono es informativo (role="status")', () => {
    render(<Alert>Mensaje</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el título antes del mensaje y el icono no forma parte del texto accesible', () => {
    render(
      <Alert tone="warning" title="Sesión caducada">
        Vuelve a iniciar sesión.
      </Alert>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sesión caducadaVuelve a iniciar sesión.');
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('acepta className y atributos nativos', () => {
    render(
      <Alert tone="success" className="mb-4" data-testid="aviso">
        Guardado
      </Alert>,
    );
    expect(screen.getByTestId('aviso')).toHaveClass('mb-4');
  });
});
