// CA-02.19 (formulario) · UserForm: alta y edición con validación en el cliente con los esquemas de
// `shared`, errores accesibles por campo (también los de la API, como el 409 de email), departamentos
// como casillas y campos bloqueados según `allowedActions` (sin mirar el rol).
import type { DepartmentSummary, UserAction } from '@incidapp/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserForm, type UserEditFormProps } from './UserForm';

const LOG: DepartmentSummary = {
  id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a01',
  code: 'LOG',
  name: 'Logística y Almacén',
};
const COM: DepartmentSummary = {
  id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a02',
  code: 'COM',
  name: 'Comercial',
};
const DEPARTMENTS = [LOG, COM];

const ALL_ACTIONS: UserAction[] = [
  'rename',
  'changeEmail',
  'changeRole',
  'changeDepartments',
  'deactivate',
  'resetPassword',
];

const MARTA = {
  name: 'Marta Gil',
  email: 'marta.gil@incidapp.test',
  role: 'MANAGER' as const,
  departmentIds: [LOG.id],
};

function fields() {
  return {
    name: screen.getByRole('textbox', { name: /nombre/i }),
    email: screen.getByRole('textbox', { name: /email/i }),
    role: screen.getByRole('combobox', { name: /rol/i }),
    departments: screen.getByRole('group', { name: /departamentos/i }),
    log: screen.getByRole('checkbox', { name: 'Logística y Almacén (LOG)' }),
    com: screen.getByRole('checkbox', { name: 'Comercial (COM)' }),
  };
}

function renderEdit(overrides: Partial<UserEditFormProps> = {}) {
  const onSubmit = vi.fn();
  const view = render(
    <UserForm
      mode="edit"
      departments={DEPARTMENTS}
      defaultValues={MARTA}
      allowedActions={ALL_ACTIONS}
      cancelHref="/admin/usuarios"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, ...view };
}

describe('UserForm · alta', () => {
  function renderCreate(onSubmit = vi.fn()) {
    render(
      <UserForm
        mode="create"
        departments={DEPARTMENTS}
        cancelHref="/admin/usuarios"
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  }

  it('CA-02.19: muestra nombre, email, rol, departamentos como casillas y contraseña', () => {
    renderCreate();

    const { name, email, role, departments } = fields();
    expect(name).toHaveValue('');
    expect(email).toHaveAttribute('type', 'email');
    expect(role).toHaveValue('USER');
    expect(
      within(role)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Admin', 'Dirección', 'Responsable', 'Usuario']);
    expect(within(departments).getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByLabelText(/contraseña inicial/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Crear usuario' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/admin/usuarios',
    );
  });

  it('CA-02.19: vacío no se envía y cada campo muestra su error de shared; el foco va al primero', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreate();

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(onSubmit).not.toHaveBeenCalled();
    const { name, email, departments, log } = fields();
    const password = screen.getByLabelText(/contraseña inicial/i);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('El nombre es obligatorio.');
    expect(email).toHaveAccessibleDescription('El email es obligatorio.');
    expect(departments).toHaveAccessibleDescription('Selecciona al menos un departamento.');
    expect(log).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password.getAttribute('aria-describedby')).toContain('-error');
    expect(screen.getByText('La contraseña es obligatoria.')).toBeInTheDocument();
    expect(name).toHaveFocus();
  });

  it('CA-02.19: una contraseña corta da el error de longitud y el foco va a ella', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreate();

    const { name, email, log } = fields();
    await user.type(name, 'Marta Gil');
    await user.type(email, 'marta.gil@incidapp.test');
    await user.click(log);
    const password = screen.getByLabelText(/contraseña inicial/i);
    await user.type(password, 'corta');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(password).toHaveFocus();
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('CA-02.19: con datos válidos llama a onSubmit con los datos normalizados por shared', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreate();

    const { name, email, role, log, com } = fields();
    await user.type(name, '  Marta Gil ');
    await user.type(email, ' Marta.Gil@IncidApp.test ');
    await user.selectOptions(role, 'MANAGER');
    await user.click(com);
    await user.click(log);
    await user.type(screen.getByLabelText(/contraseña inicial/i), 'Segura2026!');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Marta Gil',
      email: 'marta.gil@incidapp.test',
      role: 'MANAGER',
      departmentIds: [COM.id, LOG.id],
      password: 'Segura2026!',
    });
  });

  it('CA-02.19: el error de un campo desaparece al cambiar su valor', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    const { name, departments, log } = fields();
    await user.type(name, 'M');
    await user.click(log);

    expect(name).not.toHaveAttribute('aria-invalid');
    expect(departments).not.toHaveAccessibleDescription();
    expect(fields().email).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('UserForm · errores de la API', () => {
  it('CA-02.19: el 409 de email se muestra junto al campo "Email", que recibe el foco', () => {
    const { rerender, onSubmit } = renderEdit();
    expect(fields().email).not.toHaveAttribute('aria-invalid');

    const fieldErrors = { email: 'Ya existe un usuario con ese email.' };
    rerender(
      <UserForm
        mode="edit"
        departments={DEPARTMENTS}
        defaultValues={MARTA}
        allowedActions={ALL_ACTIONS}
        cancelHref="/admin/usuarios"
        onSubmit={onSubmit}
        fieldErrors={fieldErrors}
      />,
    );

    const { email } = fields();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Ya existe un usuario con ese email.');
    expect(email).toHaveFocus();
  });

  it('CA-02.19: el error de la API del campo desaparece al cambiar el email', async () => {
    const user = userEvent.setup();
    renderEdit({ fieldErrors: { email: 'Ya existe un usuario con ese email.' } });

    const { email } = fields();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    await user.type(email, 'x');
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it('el error general de la API se muestra en role="alert"', () => {
    renderEdit({ errorMessage: 'No se ha podido guardar el usuario.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido guardar el usuario.');
  });

  it('enviando, el botón está en carga y el formulario no se vuelve a enviar', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEdit({ isSubmitting: true });

    const submit = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    await user.type(fields().name, '{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('UserForm · edición', () => {
  it('CA-02.19: carga los datos del usuario, no pide contraseña y envía todos los campos permitidos', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEdit();

    const { name, email, role, log, com } = fields();
    expect(name).toHaveValue('Marta Gil');
    expect(email).toHaveValue('marta.gil@incidapp.test');
    expect(role).toHaveValue('MANAGER');
    expect(log).toBeChecked();
    expect(com).not.toBeChecked();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Marta Gil Soler');
    await user.click(com);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Marta Gil Soler',
      email: 'marta.gil@incidapp.test',
      role: 'MANAGER',
      departmentIds: [LOG.id, COM.id],
    });
  });

  it('CA-02.19: sin changeRole (el propio Admin), el rol está deshabilitado con explicación y no se envía', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEdit({
      defaultValues: { ...MARTA, role: 'ADMIN' },
      allowedActions: ['rename', 'changeEmail', 'changeDepartments', 'resetPassword'],
      lockedHint: 'No puedes cambiar tu propio rol.',
    });

    const { name, email, role, log } = fields();
    expect(role).toBeDisabled();
    expect(role).toHaveAccessibleDescription('No puedes cambiar tu propio rol.');
    expect(name).toBeEnabled();
    expect(email).toBeEnabled();
    expect(log).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Marta Gil',
      email: 'marta.gil@incidapp.test',
      departmentIds: [LOG.id],
    });
  });

  it('CA-02.19: usuario demo (solo rename): email, rol y departamentos deshabilitados; solo se envía el nombre', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEdit({
      allowedActions: ['rename'],
      lockedHint: 'Los usuarios demo no se pueden modificar.',
    });

    const { name, email, role, departments, log, com } = fields();
    expect(name).toBeEnabled();
    expect(name).not.toHaveAccessibleDescription();
    expect(email).toBeDisabled();
    expect(email).toHaveAccessibleDescription('Los usuarios demo no se pueden modificar.');
    expect(role).toBeDisabled();
    expect(departments).toBeDisabled();
    expect(departments).toHaveAccessibleDescription('Los usuarios demo no se pueden modificar.');
    expect(log).toBeDisabled();
    expect(com).toBeDisabled();

    await user.clear(name);
    await user.type(name, 'Elena Ruiz Díaz');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Elena Ruiz Díaz' });
  });

  it('sin lockedHint, los campos bloqueados llevan una explicación genérica', () => {
    renderEdit({ allowedActions: ['rename'] });
    expect(fields().email).toHaveAccessibleDescription(
      'Este dato no se puede cambiar en este usuario.',
    );
  });

  it('sin ningún campo editable, no envía y lo explica en un aviso', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEdit({ allowedActions: ['resetPassword'] });

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Indica al menos un campo que cambiar.');
  });

  it('sin departamentos en el catálogo lo indica', () => {
    renderEdit({ departments: [] });
    expect(screen.getByText('No hay departamentos disponibles.')).toBeInTheDocument();
  });
});
