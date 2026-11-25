// CA-03.14 (detalle) · IncidentSummary: código, título, estado, prioridad, tipo, departamento,
// creador, asignado, fechas en `dd/mm/aaaa` (Europe/Madrid), descripción y el hueco de acciones.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INCIDENT, UNASSIGNED_INCIDENT } from '@/test/incident-fixtures';
import { IncidentSummary } from './IncidentSummary';

/** Valor (`<dd>`) del dato con ese nombre (`<dt>`). */
function detail(label: string) {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

describe('IncidentSummary', () => {
  it('CA-03.14: muestra código, título (h1), estado y prioridad en español', () => {
    render(<IncidentSummary incident={INCIDENT} />);

    expect(screen.getByText('INC-2026-0007')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: INCIDENT.title })).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('CA-03.14: muestra tipo, departamento, creador, asignado y fechas en dd/mm/aaaa', () => {
    render(<IncidentSummary incident={INCIDENT} />);

    expect(detail('Tipo')).toHaveTextContent('Transporte');
    expect(detail('Departamento')).toHaveTextContent('Logística y Almacén (LOG)');
    expect(detail('Creada por')).toHaveTextContent('Luis Navarro');
    expect(detail('Asignada a')).toHaveTextContent('Marta Gil');
    expect(detail('Fecha objetivo')).toHaveTextContent('30/11/2026');
    expect(detail('Creada el')).toHaveTextContent('24/11/2026');
    expect(detail('Actualizada el')).toHaveTextContent('24/11/2026');
    expect(screen.queryByText('Resuelta el')).not.toBeInTheDocument();
    expect(screen.queryByText('Cerrada el')).not.toBeInTheDocument();
  });

  it('CA-03.14: las marcas de tiempo usan el día de Madrid', () => {
    render(
      <IncidentSummary
        incident={{
          ...INCIDENT,
          createdAt: '2026-12-31T23:30:00.000Z',
          updatedAt: '2026-12-31T23:30:00.000Z',
        }}
      />,
    );

    expect(detail('Creada el')).toHaveTextContent('01/01/2027');
  });

  it('CA-03.14: sin asignado ni fecha objetivo lo dice', () => {
    render(<IncidentSummary incident={UNASSIGNED_INCIDENT} />);

    expect(detail('Asignada a')).toHaveTextContent('Sin asignar');
    expect(detail('Fecha objetivo')).toHaveTextContent('Sin fecha objetivo');
  });

  it('muestra las fechas de resolución y cierre cuando las hay', () => {
    render(
      <IncidentSummary
        incident={{
          ...INCIDENT,
          status: 'CLOSED',
          resolvedAt: '2026-11-26T11:20:00.000Z',
          closedAt: '2026-11-27T08:00:00.000Z',
        }}
      />,
    );

    expect(detail('Resuelta el')).toHaveTextContent('26/11/2026');
    expect(detail('Cerrada el')).toHaveTextContent('27/11/2026');
  });

  it('CA-03.14: la descripción va en su sección y conserva los saltos de línea', () => {
    render(<IncidentSummary incident={INCIDENT} />);

    const section = screen.getByRole('region', { name: 'Descripción' });
    const text = within(section).getByText(/El palé 3 del pedido 4512/);
    expect(text.textContent).toBe(INCIDENT.description);
    expect(text).toHaveClass('whitespace-pre-line');
  });

  it('CA-03.14: pinta las acciones que recibe y ninguna si no recibe', () => {
    const { rerender } = render(<IncidentSummary incident={INCIDENT} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <IncidentSummary incident={INCIDENT} actions={<button type="button">Editar</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('el título puede usar otra etiqueta', () => {
    render(<IncidentSummary incident={INCIDENT} headingAs="h2" />);

    expect(screen.getByRole('heading', { level: 2, name: INCIDENT.title })).toBeInTheDocument();
  });
});
