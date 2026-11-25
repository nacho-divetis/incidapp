// CA-03.15 (asignación desde la web) · IncidentAssignForm: selector "Asignar a" con los candidatos,
// validación con `AssignIncidentInput`, avisos de éxito y error, y los estados de carga y sin
// candidatos.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PEOPLE } from '@/test/incident-fixtures';
import { IncidentAssignForm, type IncidentAssignFormProps } from './IncidentAssignForm';

const ASSIGNEES = Object.values(PEOPLE);

function renderForm(overrides: Partial<IncidentAssignFormProps> = {}) {
  const onAssign = vi.fn();
  const view = render(
    <IncidentAssignForm
      assignees={ASSIGNEES}
      currentAssigneeId={PEOPLE.MARTA.id}
      onAssign={onAssign}
      {...overrides}
    />,
  );
  return { onAssign, ...view };
}

const select = () => screen.getByRole('combobox', { name: 'Asignar a' });
const assignButton = () => screen.getByRole('button', { name: 'Asignar' });

describe('IncidentAssignForm', () => {
  it('CA-03.15: es una sección con los candidatos y el asignado actual elegido', () => {
    renderForm();

    expect(screen.getByRole('region', { name: 'Asignación' })).toBeInTheDocument();
    expect(select()).toHaveDisplayValue('Marta Gil');
    const options = Array.from(select().querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Selecciona una persona', 'Luis Navarro', 'Marta Gil', 'Pablo Sanz']);
  });

  it('CA-03.15: al elegir a alguien y pulsar "Asignar" avisa con su id', async () => {
    const { onAssign } = renderForm();

    await userEvent.selectOptions(select(), 'Pablo Sanz');
    await userEvent.click(assignButton());

    expect(onAssign).toHaveBeenCalledWith(PEOPLE.PABLO.id);
  });

  it('CA-03.15: sin elegir a nadie no avisa y el error va junto al selector', async () => {
    const { onAssign } = renderForm({ currentAssigneeId: null });

    await userEvent.click(assignButton());

    expect(onAssign).not.toHaveBeenCalled();
    expect(select()).toHaveAttribute('aria-invalid', 'true');
    expect(select()).toHaveAccessibleDescription('Selecciona a quién asignarla.');
    expect(select()).toHaveFocus();

    await userEvent.selectOptions(select(), 'Luis Navarro');
    expect(select()).not.toHaveAttribute('aria-invalid');
  });

  it('CA-03.15: muestra el aviso de éxito', () => {
    renderForm({ notice: 'Incidencia asignada.' });

    expect(screen.getByRole('status')).toHaveTextContent('Incidencia asignada.');
  });

  it('CA-03.15: muestra el error de la API sin perder la elección', async () => {
    const { rerender, onAssign } = renderForm();
    await userEvent.selectOptions(select(), 'Pablo Sanz');

    rerender(
      <IncidentAssignForm
        assignees={ASSIGNEES}
        currentAssigneeId={PEOPLE.MARTA.id}
        onAssign={onAssign}
        errorMessage="El usuario no pertenece al departamento de la incidencia o está desactivado."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El usuario no pertenece al departamento de la incidencia o está desactivado.',
    );
    expect(select()).toHaveDisplayValue('Pablo Sanz');
  });

  it('mientras asigna, el botón está en carga y no reenvía', () => {
    const { onAssign } = renderForm({ isPending: true });

    expect(assignButton()).toBeDisabled();
    expect(assignButton()).toHaveAttribute('aria-busy', 'true');
    fireEvent.submit(assignButton().closest('form')!);
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('mientras cargan los candidatos, muestra un indicador y no el selector', () => {
    renderForm({ isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando usuarios…');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('sin candidatos, lo explica y deshabilita el control', () => {
    renderForm({ assignees: [], currentAssigneeId: null });

    expect(select()).toBeDisabled();
    expect(select()).toHaveAccessibleDescription(
      'No hay usuarios activos en el departamento de la incidencia.',
    );
    expect(assignButton()).toBeDisabled();
  });
});
