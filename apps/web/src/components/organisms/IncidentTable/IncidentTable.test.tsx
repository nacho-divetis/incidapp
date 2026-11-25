// CA-03.12 (tabla del listado) · IncidentTable: columnas, insignias en español, fechas `dd/mm/aaaa`,
// enlace al detalle, vacío y carga.
import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { INCIDENT_LIST_ITEMS } from '@/test/incident-fixtures';
import { IncidentTable } from './IncidentTable';

const [FIRST, SECOND, THIRD] = INCIDENT_LIST_ITEMS as [
  (typeof INCIDENT_LIST_ITEMS)[number],
  (typeof INCIDENT_LIST_ITEMS)[number],
  (typeof INCIDENT_LIST_ITEMS)[number],
];

const detailHref = (id: string) => `/incidencias/${id}`;

function rowOf(code: string) {
  const header = screen.getByRole('rowheader', { name: code });
  return header.closest('tr') as HTMLTableRowElement;
}

describe('IncidentTable', () => {
  it('CA-03.12: es una tabla con nombre y las columnas del listado', () => {
    render(<IncidentTable items={INCIDENT_LIST_ITEMS} getDetailHref={detailHref} />);

    const table = screen.getByRole('table', { name: 'Incidencias' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Código',
      'Título',
      'Tipo',
      'Departamento',
      'Prioridad',
      'Estado',
      'Asignado',
      'Fecha objetivo',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(1 + INCIDENT_LIST_ITEMS.length);
  });

  it('CA-03.12: cada fila muestra sus datos en español y la fecha en dd/mm/aaaa', () => {
    render(<IncidentTable items={INCIDENT_LIST_ITEMS} getDetailHref={detailHref} />);

    const [title, type, department, priority, status, assignee, dueDate] = within(
      rowOf(SECOND.code),
    ).getAllByRole('cell');
    expect(title).toHaveTextContent(SECOND.title);
    expect(type).toHaveTextContent('Cliente / Reclamación');
    expect(priority).toHaveTextContent('Urgente');
    expect(status).toHaveTextContent('En curso');
    expect(assignee).toHaveTextContent('Pablo Sanz');
    expect(dueDate).toHaveTextContent('26/11/2026');
    // El departamento se ve por su código y se lee por su nombre completo.
    expect(within(department!).getByText('ATC')).toHaveAttribute('aria-hidden', 'true');
    expect(within(department!).getByText('Atención al Cliente / Postventa')).toHaveClass('sr-only');
    expect(department!.firstElementChild).toHaveAttribute(
      'title',
      'Atención al Cliente / Postventa',
    );
  });

  it('CA-03.12: el código enlaza al detalle de la incidencia', () => {
    render(<IncidentTable items={INCIDENT_LIST_ITEMS} getDetailHref={detailHref} />);

    expect(screen.getByRole('link', { name: FIRST.code })).toHaveAttribute(
      'href',
      `/incidencias/${FIRST.id}`,
    );
  });

  it('una incidencia sin asignado ni fecha objetivo lo dice', () => {
    render(<IncidentTable items={INCIDENT_LIST_ITEMS} getDetailHref={detailHref} />);

    const row = within(rowOf(THIRD.code));
    expect(row.getByText('Sin asignar')).toBeInTheDocument();
    expect(row.getByText('Sin fecha')).toBeInTheDocument();
  });

  it('con linkAs, el enlace recibe el destino en `to`', () => {
    function FakeRouterLink({ to, ...props }: ComponentProps<'a'> & { to: string }) {
      return <a href={`router:${to}`} {...props} />;
    }
    render(<IncidentTable items={[FIRST]} getDetailHref={detailHref} linkAs={FakeRouterLink} />);

    expect(screen.getByRole('link', { name: FIRST.code })).toHaveAttribute(
      'href',
      `router:/incidencias/${FIRST.id}`,
    );
  });

  it('CA-03.12: sin resultados muestra el estado vacío y no la tabla', () => {
    render(<IncidentTable items={[]} getDetailHref={detailHref} />);

    expect(
      screen.getByText('No hay incidencias que coincidan con los filtros.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('CA-03.12: mientras carga muestra un indicador y no la tabla ni el vacío', () => {
    render(<IncidentTable items={[]} getDetailHref={detailHref} isLoading />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando incidencias…');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No hay incidencias que coincidan con los filtros.'),
    ).not.toBeInTheDocument();
  });
});
