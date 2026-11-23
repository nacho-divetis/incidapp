// CA-00.19 · Button: el clic solo se dispara si el botón está activo; en carga expone `aria-busy`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('CA-00.19: dispara onClick al pulsarlo y es de tipo button por defecto', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('type', 'button');
  });

  it('CA-00.19: respeta type="submit"', () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit');
  });

  it('CA-00.19: no dispara onClick si está deshabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Guardar' });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('CA-00.19: en carga no dispara onClick, expone aria-busy y muestra el indicador en lugar del icono', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick} leftIcon={<svg data-testid="icono" />}>
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Guardar' });
    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg.animate-spin')).toBeInTheDocument();
    expect(screen.queryByTestId('icono')).not.toBeInTheDocument();
  });

  it('CA-00.19: sin carga no expone aria-busy y muestra el icono oculto a los lectores de pantalla', () => {
    render(<Button leftIcon={<svg data-testid="icono" />}>Nueva</Button>);

    const button = screen.getByRole('button', { name: 'Nueva' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(screen.getByTestId('icono').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('CA-00.19: se puede enfocar con el teclado y tiene foco visible', async () => {
    render(<Button>Guardar</Button>);

    await userEvent.tab();

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toHaveFocus();
    expect(button).toHaveClass('focus-visible:focus-ring');
  });

  it('CA-00.19: combina la className recibida con las variantes', () => {
    render(
      <Button variant="danger" size="sm" className="w-full">
        Borrar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Borrar' });
    expect(button).toHaveClass('bg-danger', 'h-8', 'w-full');
  });
});
