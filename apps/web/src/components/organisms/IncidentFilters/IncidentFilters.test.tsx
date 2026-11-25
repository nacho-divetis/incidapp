// CA-03.12 (filtros del listado) · IncidentFilters: estado, prioridad, departamento, "Asignadas a mí"
// y buscador, controlados y con etiquetas en español.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { INCIDENT_DEPARTMENT_LIST, INCIDENT_DEPARTMENTS } from '@/test/incident-fixtures';
import {
  EMPTY_INCIDENT_FILTERS,
  IncidentFilters,
  type IncidentFiltersValue,
} from './IncidentFilters';

/** Monta los filtros con su valor en estado, como hará la página. */
function renderControlled(initial: IncidentFiltersValue = EMPTY_INCIDENT_FILTERS) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <IncidentFilters
        value={value}
        departments={INCIDENT_DEPARTMENT_LIST}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }
  render(<Harness />);
  return onChange;
}

function controls() {
  return {
    search: screen.getByRole('searchbox', { name: 'Buscar' }),
    status: screen.getByRole('combobox', { name: 'Estado' }),
    priority: screen.getByRole('combobox', { name: 'Prioridad' }),
    department: screen.getByRole('combobox', { name: 'Departamento' }),
    mine: screen.getByRole('checkbox', { name: 'Asignadas a mí' }),
  };
}

describe('IncidentFilters', () => {
  it('CA-03.12: es una zona de búsqueda con los cinco filtros, sin ninguno puesto', () => {
    renderControlled();

    expect(screen.getByRole('search', { name: 'Filtros de incidencias' })).toBeInTheDocument();
    const { search, status, priority, department, mine } = controls();
    expect(search).toHaveValue('');
    expect(status).toHaveDisplayValue('Todos');
    expect(priority).toHaveDisplayValue('Todas');
    expect(department).toHaveDisplayValue('Todos');
    expect(mine).not.toBeChecked();
  });

  it('CA-03.12: estados y prioridades en español, y los departamentos del catálogo', () => {
    renderControlled();

    const options = (select: HTMLElement) =>
      Array.from(select.querySelectorAll('option')).map((option) => option.textContent);
    const { status, priority, department } = controls();
    expect(options(status)).toEqual([
      'Todos',
      'Abierta',
      'En curso',
      'Pendiente de tercero',
      'Resuelta',
      'Cerrada',
      'Rechazada',
      'Reabierta',
    ]);
    expect(options(priority)).toEqual(['Todas', 'Baja', 'Media', 'Alta', 'Urgente']);
    expect(options(department)).toEqual([
      'Todos',
      'Logística y Almacén',
      'Atención al Cliente / Postventa',
      'Departamento Técnico',
    ]);
  });

  it('CA-03.12: cada cambio avisa con todos los filtros, sin perder los demás', async () => {
    const onChange = renderControlled();
    const { status, priority, department, mine } = controls();

    await userEvent.selectOptions(status, 'En curso');
    await userEvent.selectOptions(priority, 'Urgente');
    await userEvent.selectOptions(department, 'Atención al Cliente / Postventa');
    await userEvent.click(mine);

    expect(onChange).toHaveBeenLastCalledWith({
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      departmentId: INCIDENT_DEPARTMENTS.ATC.id,
      assignedToMe: true,
      q: '',
    });
  });

  it('volver a "Todos" quita el filtro', async () => {
    const onChange = renderControlled({
      ...EMPTY_INCIDENT_FILTERS,
      status: 'OPEN',
      departmentId: INCIDENT_DEPARTMENTS.LOG.id,
    });
    const { status, department } = controls();

    await userEvent.selectOptions(status, 'Todos');
    await userEvent.selectOptions(department, 'Todos');

    expect(onChange).toHaveBeenLastCalledWith({
      status: undefined,
      departmentId: undefined,
      assignedToMe: false,
      q: '',
    });
  });

  it('el buscador avisa con cada tecla y pulsar Intro no envía nada', async () => {
    const onChange = renderControlled();
    const submit = vi.fn();
    window.addEventListener('submit', submit);

    await userEvent.type(controls().search, 'INC-7{Enter}');

    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_INCIDENT_FILTERS, q: 'INC-7' });
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(submit.mock.calls[0]?.[0]).toHaveProperty('defaultPrevented', true);
    window.removeEventListener('submit', submit);
  });

  it('muestra los filtros que recibe', () => {
    renderControlled({
      status: 'RESOLVED',
      priority: 'LOW',
      departmentId: INCIDENT_DEPARTMENTS.TEC.id,
      assignedToMe: true,
      q: 'impresora',
    });

    const { search, status, priority, department, mine } = controls();
    expect(search).toHaveValue('impresora');
    expect(status).toHaveDisplayValue('Resuelta');
    expect(priority).toHaveDisplayValue('Baja');
    expect(department).toHaveDisplayValue('Departamento Técnico');
    expect(mine).toBeChecked();
  });
});
