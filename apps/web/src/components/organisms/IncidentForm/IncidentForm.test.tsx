// CA-03.13 (alta) y CA-03.15 (edición) · IncidentForm: validación en el cliente con los esquemas de
// `shared`, errores accesibles por campo (también los de la API), departamento del tipo elegido y,
// en la edición, sin tipo y con la fecha objetivo borrable.
import { INCIDENT_TITLE_MAX_LENGTH } from '@incidapp/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { INCIDENT, INCIDENT_TYPE_LIST, INCIDENT_TYPES } from '@/test/incident-fixtures';
import { IncidentForm, type IncidentFormProps } from './IncidentForm';

function fields() {
  return {
    title: screen.getByRole('textbox', { name: /título/i }),
    description: screen.getByRole('textbox', { name: /descripción/i }),
    priority: screen.getByRole('combobox', { name: /prioridad/i }),
    dueDate: screen.getByLabelText(/fecha objetivo/i),
  };
}

function typeSelect() {
  return screen.getByRole('combobox', { name: /tipo/i });
}

function renderCreate(overrides: Partial<Extract<IncidentFormProps, { mode: 'create' }>> = {}) {
  const onSubmit = vi.fn();
  const view = render(
    <IncidentForm
      mode="create"
      types={INCIDENT_TYPE_LIST}
      cancelHref="/incidencias"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, ...view };
}

const EDIT_DEFAULTS = {
  title: INCIDENT.title,
  description: INCIDENT.description,
  priority: INCIDENT.priority,
  dueDate: INCIDENT.dueDate,
};

function renderEdit(overrides: Partial<Extract<IncidentFormProps, { mode: 'edit' }>> = {}) {
  const onSubmit = vi.fn();
  const view = render(
    <IncidentForm
      mode="edit"
      defaultValues={EDIT_DEFAULTS}
      cancelHref={`/incidencias/${INCIDENT.id}`}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, ...view };
}

describe('IncidentForm · alta', () => {
  it('CA-03.13: muestra título, descripción, tipo, prioridad (Media) y fecha objetivo opcional', () => {
    renderCreate();

    const { title, description, priority, dueDate } = fields();
    expect(title).toBeRequired();
    expect(description).toBeRequired();
    expect(typeSelect()).toHaveDisplayValue('Selecciona un tipo');
    expect(priority).toHaveDisplayValue('Media');
    expect(dueDate).toHaveAttribute('type', 'date');
    expect(dueDate).not.toBeRequired();
    expect(screen.getByRole('button', { name: 'Crear incidencia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/incidencias');
  });

  it('CA-03.13: al elegir el tipo, la ayuda dice qué departamento la recibirá', async () => {
    renderCreate();

    await userEvent.selectOptions(typeSelect(), 'Cliente / Reclamación');

    expect(typeSelect()).toHaveAccessibleDescription(
      'Lo recibirá: Atención al Cliente / Postventa.',
    );
  });

  it('CA-03.13: valida con el esquema de shared y pone cada error junto a su campo', async () => {
    const { onSubmit } = renderCreate();

    await userEvent.click(screen.getByRole('button', { name: 'Crear incidencia' }));

    const { title, description } = fields();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('El título es obligatorio.');
    expect(description).toHaveAccessibleDescription('La descripción es obligatoria.');
    expect(typeSelect()).toHaveAttribute('aria-invalid', 'true');
    expect(typeSelect()).toHaveAccessibleDescription(
      expect.stringContaining('Selecciona el tipo de incidencia.'),
    );
    expect(title).toHaveFocus();
  });

  it('CA-03.13: rechaza un título demasiado largo', async () => {
    const { onSubmit } = renderCreate({
      defaultValues: {
        title: 'x'.repeat(INCIDENT_TITLE_MAX_LENGTH + 1),
        description: 'Descripción',
        typeId: INCIDENT_TYPES.TRANSPORT.id,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Crear incidencia' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fields().title).toHaveAccessibleDescription(
      `El título no puede tener más de ${INCIDENT_TITLE_MAX_LENGTH} caracteres.`,
    );
  });

  it('el error de un campo desaparece al cambiar su valor', async () => {
    renderCreate();
    await userEvent.click(screen.getByRole('button', { name: 'Crear incidencia' }));

    await userEvent.type(fields().title, 'Palé dañado');

    expect(fields().title).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('El título es obligatorio.')).not.toBeInTheDocument();
    expect(screen.getByText('La descripción es obligatoria.')).toBeInTheDocument();
  });

  it('CA-03.13: envía los datos validados (sin espacios en los extremos y sin fecha vacía)', async () => {
    const { onSubmit } = renderCreate();
    const { title, description, priority } = fields();

    await userEvent.type(title, '  Palé dañado  ');
    await userEvent.type(description, 'Llegó con el film roto.');
    await userEvent.selectOptions(typeSelect(), 'Transporte');
    await userEvent.selectOptions(priority, 'Urgente');
    await userEvent.click(screen.getByRole('button', { name: 'Crear incidencia' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Palé dañado',
      description: 'Llegó con el film roto.',
      typeId: INCIDENT_TYPES.TRANSPORT.id,
      priority: 'URGENT',
    });
  });

  it('CA-03.13: envía la fecha objetivo si se indica', async () => {
    const { onSubmit } = renderCreate({
      defaultValues: {
        title: 'Palé dañado',
        description: 'Llegó con el film roto.',
        typeId: INCIDENT_TYPES.TRANSPORT.id,
      },
    });

    fireEvent.change(fields().dueDate, { target: { value: '2026-12-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear incidencia' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueDate: '2026-12-01' }));
  });

  it('CA-03.13: muestra los errores de la API junto a su campo y lleva el foco al primero', () => {
    const { rerender, onSubmit } = renderCreate({
      defaultValues: { title: 'Palé dañado', typeId: INCIDENT_TYPES.TRANSPORT.id },
    });

    rerender(
      <IncidentForm
        mode="create"
        types={INCIDENT_TYPE_LIST}
        cancelHref="/incidencias"
        onSubmit={onSubmit}
        defaultValues={{ title: 'Palé dañado', typeId: INCIDENT_TYPES.TRANSPORT.id }}
        fieldErrors={{ typeId: 'El tipo de incidencia no existe.' }}
        errorMessage="No se ha podido crear la incidencia."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido crear la incidencia.');
    expect(typeSelect()).toHaveAccessibleDescription(
      expect.stringContaining('El tipo de incidencia no existe.'),
    );
    expect(typeSelect()).toHaveFocus();
    // Lo escrito no se pierde.
    expect(fields().title).toHaveValue('Palé dañado');
  });

  it('mientras envía, el botón está en carga y no reenvía', async () => {
    const { onSubmit } = renderCreate({
      isSubmitting: true,
      defaultValues: {
        title: 'Palé dañado',
        description: 'Llegó con el film roto.',
        typeId: INCIDENT_TYPES.TRANSPORT.id,
      },
    });

    const submit = screen.getByRole('button', { name: 'Crear incidencia' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    fireEvent.submit(submit.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('IncidentForm · edición', () => {
  it('CA-03.15: viene precargado, sin campo de tipo y con "Guardar cambios"', () => {
    renderEdit();

    const { title, description, priority, dueDate } = fields();
    expect(title).toHaveValue(INCIDENT.title);
    expect(description).toHaveValue(INCIDENT.description);
    expect(priority).toHaveDisplayValue('Alta');
    expect(dueDate).toHaveValue('2026-11-30');
    expect(screen.queryByRole('combobox', { name: /tipo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      `/incidencias/${INCIDENT.id}`,
    );
  });

  it('CA-03.15: envía los campos validados con UpdateIncidentInput', async () => {
    const { onSubmit } = renderEdit();

    await userEvent.clear(fields().title);
    await userEvent.type(fields().title, 'Palé dañado (revisado)');
    await userEvent.selectOptions(fields().priority, 'Urgente');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Palé dañado (revisado)',
      description: INCIDENT.description,
      priority: 'URGENT',
      dueDate: '2026-11-30',
    });
  });

  it('CA-03.15: vaciar la fecha objetivo la quita (null)', async () => {
    const { onSubmit } = renderEdit();

    fireEvent.change(fields().dueDate, { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueDate: null }));
  });

  it('CA-03.15: con la descripción vacía no envía y marca el campo', async () => {
    const { onSubmit } = renderEdit();

    await userEvent.clear(fields().description);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fields().description).toHaveAccessibleDescription('La descripción es obligatoria.');
    expect(fields().description).toHaveFocus();
  });

  it('CA-03.15: un error general de la API se muestra sin perder lo escrito', async () => {
    const { rerender, onSubmit } = renderEdit();
    await userEvent.type(fields().title, ' bis');

    rerender(
      <IncidentForm
        mode="edit"
        defaultValues={EDIT_DEFAULTS}
        cancelHref={`/incidencias/${INCIDENT.id}`}
        onSubmit={onSubmit}
        errorMessage="No tienes permiso para editar esta incidencia."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No tienes permiso para editar esta incidencia.',
    );
    expect(fields().title).toHaveValue(`${INCIDENT.title} bis`);
  });
});
