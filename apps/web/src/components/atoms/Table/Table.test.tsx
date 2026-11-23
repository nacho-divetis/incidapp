// CA-02.18 (tabla accesible) · Table: partes semánticas, cabeceras con `scope`, nombre accesible y
// contenedor con desplazamiento horizontal propio (enfocable si se le da nombre).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type TableProps,
} from './Table';

function Example(props: TableProps) {
  return (
    <Table {...props}>
      <TableCaption>Salas de reuniones</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sala</TableHeaderCell>
          <TableHeaderCell>Plazas</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableHeaderCell scope="row">Sala Norte</TableHeaderCell>
          <TableCell>12</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table', () => {
  it('CA-02.18: es una tabla con nombre y cabeceras de columna con scope="col"', () => {
    render(<Example />);

    const table = screen.getByRole('table', { name: 'Salas de reuniones' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Sala', 'Plazas']);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
  });

  it('CA-02.18: la cabecera de fila tiene scope="row" y da nombre a sus celdas', () => {
    render(<Example />);

    const rowHeader = screen.getByRole('rowheader', { name: 'Sala Norte' });
    expect(rowHeader).toHaveAttribute('scope', 'row');
    expect(screen.getByRole('cell', { name: '12' })).toBeInTheDocument();
    // Cabecera + una fila de datos.
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('CA-02.18: el contenedor tiene desplazamiento horizontal propio', () => {
    render(<Example />);
    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });

  it('sin regionLabel el contenedor no es una región ni recibe el foco', async () => {
    render(<Example />);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it('con regionLabel el contenedor es una región con nombre que se enfoca con el tabulador', async () => {
    render(<Example regionLabel="Salas (desplazable)" />);

    const region = screen.getByRole('region', { name: 'Salas (desplazable)' });
    await userEvent.tab();
    expect(region).toHaveFocus();
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });

  it('className va a la tabla y containerClassName al contenedor', () => {
    render(<Example className="table-fixed" containerClassName="mt-4" aria-describedby="x" />);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('table-fixed');
    expect(table).toHaveAttribute('aria-describedby', 'x');
    expect(table.parentElement).toHaveClass('mt-4');
  });
});
