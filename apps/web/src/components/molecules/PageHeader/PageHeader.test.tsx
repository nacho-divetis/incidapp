// PageHeader: título principal de la página (h1), descripción y hueco de acciones.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../atoms';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('pinta el título como h1 y la descripción', () => {
    render(<PageHeader title="Usuarios" description="Gestión de cuentas." />);

    expect(screen.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(screen.getByText('Gestión de cuentas.')).toBeInTheDocument();
  });

  it('pinta las acciones y estas responden', async () => {
    const onClick = vi.fn();
    render(
      <PageHeader title="Usuarios" actions={<Button onClick={onClick}>Nuevo usuario</Button>} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sin descripción ni acciones solo queda el título', () => {
    const { container } = render(<PageHeader title="Usuarios" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelectorAll('p')).toHaveLength(0);
    expect(container.firstElementChild?.childElementCount).toBe(1);
  });

  it('pasa las props nativas y combina className', () => {
    render(<PageHeader title="Usuarios" className="mb-6" data-testid="cabecera" />);
    expect(screen.getByTestId('cabecera')).toHaveClass('mb-6', 'flex');
  });
});
