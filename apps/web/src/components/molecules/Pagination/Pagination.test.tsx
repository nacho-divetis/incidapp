// CA-03.12 (paginación del listado) · Pagination: total, página, "Anterior" / "Siguiente" y extremos.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

function buttons() {
  return {
    previous: screen.getByRole('button', { name: 'Anterior' }),
    next: screen.getByRole('button', { name: 'Siguiente' }),
  };
}

describe('Pagination', () => {
  it('es una navegación con nombre que muestra el total y la página', () => {
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByText('45 resultados · Página 2 de 3')).toBeInTheDocument();
  });

  it('en una página intermedia, va a la anterior y a la siguiente', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={onPageChange} />);

    await userEvent.click(buttons().previous);
    await userEvent.click(buttons().next);

    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });

  it('en la primera página, "Anterior" está deshabilitado', () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(buttons().previous).toBeDisabled();
    expect(buttons().next).toBeEnabled();
  });

  it('en la última página, "Siguiente" está deshabilitado', () => {
    render(<Pagination page={3} pageSize={20} total={45} onPageChange={vi.fn()} />);

    expect(buttons().previous).toBeEnabled();
    expect(buttons().next).toBeDisabled();
  });

  it('sin resultados hay una sola página y ningún botón activo', () => {
    render(<Pagination page={1} pageSize={20} total={0} onPageChange={vi.fn()} />);

    expect(screen.getByText('0 resultados · Página 1 de 1')).toBeInTheDocument();
    expect(buttons().previous).toBeDisabled();
    expect(buttons().next).toBeDisabled();
  });

  it('usa el singular con un único resultado', () => {
    render(<Pagination page={1} pageSize={20} total={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('1 resultado · Página 1 de 1')).toBeInTheDocument();
  });

  it('con disabled, ningún botón responde', () => {
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={vi.fn()} disabled />);

    expect(buttons().previous).toBeDisabled();
    expect(buttons().next).toBeDisabled();
  });

  it('acepta otros textos', () => {
    render(
      <Pagination
        page={1}
        pageSize={10}
        total={30}
        onPageChange={vi.fn()}
        label="Páginas de incidencias"
        previousLabel="Atrás"
        nextLabel="Más"
        formatSummary={({ total }) => `Hay ${total}`}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Páginas de incidencias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Más' })).toBeEnabled();
    expect(screen.getByText('Hay 30')).toBeInTheDocument();
  });
});
