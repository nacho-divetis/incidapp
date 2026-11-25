// CA-02.19 (edición), CA-02.20 y CA-02.21 con `fetch` simulado (rutas y providers reales).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_ADMIN, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import { renderApp } from '../../test/render-app';
import {
  DEMO_MANAGER,
  DEPARTMENTS,
  LUCIA,
  SELF_ADMIN,
  deactivated,
} from '../../test/user-fixtures';
import type { UserAdmin } from '@incidapp/shared';

const ME = 'GET /api/auth/me';
const USERS = 'GET /api/users';
const editPath = (user: UserAdmin) => `/admin/usuarios/${user.id}`;

/** Respuesta que llega tras unos milisegundos. */
const delayed = (response: Response) =>
  new Promise<Response>((resolve) => setTimeout(() => resolve(response), 20));

function setupApi(user: UserAdmin) {
  return mockApi({
    [ME]: () => jsonResponse(200, DEMO_ADMIN),
    'GET /api/departments': () => jsonResponse(200, DEPARTMENTS),
    [`GET /api/users/${user.id}`]: () => jsonResponse(200, user),
  });
}

function fields() {
  return {
    name: screen.getByRole('textbox', { name: /nombre/i }),
    email: screen.getByRole('textbox', { name: /email/i }),
    role: screen.getByRole('combobox', { name: /rol/i }),
    departments: screen.getByRole('group', { name: /departamentos/i }),
  };
}

const saveButton = () => screen.findByRole('button', { name: 'Guardar cambios' });

describe('CA-02.19 · edición de usuario', () => {
  it('mientras carga muestra un indicador', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      'GET /api/departments': () => jsonResponse(200, DEPARTMENTS),
      [`GET /api/users/${LUCIA.id}`]: never,
    });

    renderApp(editPath(LUCIA));

    expect(await screen.findByText('Cargando el usuario…')).toBeInTheDocument();
  });

  it('muestra los datos del usuario sin contraseña', async () => {
    setupApi(LUCIA);

    renderApp(editPath(LUCIA));

    await saveButton();
    const form = fields();
    expect(form.name).toHaveValue('Lucía Gil');
    expect(form.email).toHaveValue(LUCIA.email);
    expect(form.role).toHaveValue('MANAGER');
    expect(
      within(form.departments).getByRole('checkbox', { name: 'Logística (LOG)' }),
    ).toBeChecked();
    expect(
      within(form.departments).getByRole('checkbox', { name: 'Administración (ADM)' }),
    ).not.toBeChecked();
    expect(screen.queryByLabelText(/contraseña inicial/i)).not.toBeInTheDocument();
    for (const field of [form.name, form.email, form.role]) expect(field).toBeEnabled();
  });

  it('al guardar envía los cambios y vuelve al listado con los datos nuevos y un aviso', async () => {
    const renamed = { ...LUCIA, name: 'Lucía Gil Pérez' };
    const api = setupApi(LUCIA);
    api.on(`PATCH /api/users/${LUCIA.id}`, () => jsonResponse(200, renamed));
    api.on(USERS, () => jsonResponse(200, [renamed]));
    const user = userEvent.setup();
    const { currentPath } = renderApp(editPath(LUCIA));
    await saveButton();

    await user.clear(fields().name);
    await user.type(fields().name, renamed.name);
    await user.click(await saveButton());

    expect(await screen.findByText('Cambios de Lucía Gil Pérez guardados.')).toBeInTheDocument();
    expect(currentPath()).toBe('/admin/usuarios');
    expect(await screen.findByRole('link', { name: 'Lucía Gil Pérez' })).toBeInTheDocument();
    const [request] = api.callsTo(`PATCH /api/users/${LUCIA.id}`);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      name: renamed.name,
      email: LUCIA.email,
      role: 'MANAGER',
      departmentIds: LUCIA.departments.map((department) => department.id),
    });
  });

  it('un 409 al cambiar el email se muestra junto al campo "Email"', async () => {
    const api = setupApi(LUCIA);
    api.on(`PATCH /api/users/${LUCIA.id}`, () =>
      errorResponse(409, 'CONFLICT', 'Ya existe un usuario con ese email.'),
    );
    const user = userEvent.setup();
    const { currentPath } = renderApp(editPath(LUCIA));
    await saveButton();

    await user.clear(fields().email);
    await user.type(fields().email, 'repetido@incidapp.test');
    await user.click(await saveButton());

    const { email } = fields();
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/Ya existe un usuario con ese email\./);
    expect(currentPath()).toBe(editPath(LUCIA));
  });

  it('un 409 sin cambio de email (regla de negocio) va al aviso general', async () => {
    const api = setupApi(LUCIA);
    api.on(`PATCH /api/users/${LUCIA.id}`, () =>
      errorResponse(409, 'CONFLICT', 'Los usuarios demo no se pueden modificar.'),
    );
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));

    await user.click(await saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los usuarios demo no se pueden modificar.',
    );
    expect(fields().email).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('el propio Admin: el rol aparece deshabilitado con una explicación', async () => {
    setupApi({
      ...SELF_ADMIN,
      email: 'elena.admin@incidapp.test',
      allowedActions: ['rename', 'changeEmail', 'changeDepartments', 'resetPassword'],
    });
    renderApp(editPath(SELF_ADMIN));
    await saveButton();

    const { name, email, role } = fields();
    expect(role).toBeDisabled();
    expect(role).toHaveAccessibleDescription('No puedes cambiar tu propio rol.');
    expect(name).toBeEnabled();
    expect(email).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument();
  });

  it('un usuario demo: solo el nombre se puede cambiar, y sin acciones sobre la cuenta', async () => {
    const api = setupApi(DEMO_MANAGER);
    api.on(`PATCH /api/users/${DEMO_MANAGER.id}`, () => jsonResponse(200, DEMO_MANAGER));
    api.on(USERS, never);
    const user = userEvent.setup();
    renderApp(editPath(DEMO_MANAGER));
    await saveButton();

    const { name, email, role, departments } = fields();
    expect(name).toBeEnabled();
    for (const field of [email, role]) {
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(
        'Los usuarios demo no se pueden modificar: solo se puede cambiar el nombre.',
      );
    }
    expect(departments).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivar usuario' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restablecer contraseña' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Los usuarios demo no se pueden desactivar ni cambiar de contraseña.'),
    ).toBeInTheDocument();

    // Solo se envía el nombre: los campos bloqueados no viajan.
    await user.click(await saveButton());
    await waitFor(() => expect(api.callsTo(`PATCH /api/users/${DEMO_MANAGER.id}`)).toHaveLength(1));
    expect(
      JSON.parse(String(api.callsTo(`PATCH /api/users/${DEMO_MANAGER.id}`)[0]?.init.body)),
    ).toEqual({
      name: DEMO_MANAGER.name,
    });
  });

  it('un usuario inexistente muestra "No existe ese usuario." con un enlace al listado', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      'GET /api/departments': () => jsonResponse(200, DEPARTMENTS),
      'GET /api/users/no-existe': () => errorResponse(404, 'NOT_FOUND', 'No encontrado.'),
    });

    renderApp('/admin/usuarios/no-existe');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No existe ese usuario.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al listado de usuarios' })).toHaveAttribute(
      'href',
      '/admin/usuarios',
    );
  });

  it('otro error al cargar se muestra en un `Alert`', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      'GET /api/departments': () => jsonResponse(200, DEPARTMENTS),
      [`GET /api/users/${LUCIA.id}`]: () =>
        errorResponse(403, 'FORBIDDEN', 'No tienes permiso para hacer esto.'),
    });

    renderApp(editPath(LUCIA));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para hacer esto.',
    );
  });
});

describe('CA-02.20 · desactivar y reactivar', () => {
  it('desactivar pide confirmación antes de llamar a la API y actualiza la página y el listado', async () => {
    const api = mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      'GET /api/departments': () => jsonResponse(200, DEPARTMENTS),
      [USERS]: () => jsonResponse(200, [LUCIA]),
      [`GET /api/users/${LUCIA.id}`]: () => jsonResponse(200, LUCIA),
      [`POST /api/users/${LUCIA.id}/deactivate`]: () => jsonResponse(200, deactivated(LUCIA)),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/admin/usuarios');
    // Del listado (que queda en la caché) a la edición.
    await user.click(await screen.findByRole('link', { name: 'Lucía Gil' }));
    await saveButton();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar a Lucía Gil?' });
    expect(api.callsTo(`POST /api/users/${LUCIA.id}/deactivate`)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    expect(
      await screen.findByText('Usuario desactivado. Se han cerrado sus sesiones.'),
    ).toBeInTheDocument();
    expect(api.callsTo(`POST /api/users/${LUCIA.id}/deactivate`)).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const account = screen.getByRole('region', { name: 'Cuenta' });
    expect(within(account).getByText('Desactivado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivar usuario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();

    // El listado ya muestra el estado nuevo (aunque su recarga no haya terminado).
    api.on(USERS, never);
    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    expect(currentPath()).toBe('/admin/usuarios');
    const row = (await screen.findByRole('link', { name: 'Lucía Gil' })).closest('tr');
    expect(row).toHaveTextContent('Desactivado');
  });

  it('cancelar la confirmación no llama a la API', async () => {
    const api = setupApi(LUCIA);
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));
    await saveButton();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('si la desactivación falla, muestra el error dentro del diálogo', async () => {
    const api = setupApi(LUCIA);
    api.on(`POST /api/users/${LUCIA.id}/deactivate`, () =>
      errorResponse(
        409,
        'CONFLICT',
        'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.',
      ),
    );
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));
    await saveButton();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.',
    );
  });

  it('reactivar no pide confirmación y actualiza el estado', async () => {
    const inactive = deactivated(LUCIA);
    const api = setupApi(inactive);
    api.on(`POST /api/users/${LUCIA.id}/activate`, () => jsonResponse(200, LUCIA));
    const user = userEvent.setup();
    renderApp(editPath(inactive));
    await saveButton();

    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reactivar usuario' }));

    expect(await screen.findByText('Usuario reactivado.')).toBeInTheDocument();
    expect(api.callsTo(`POST /api/users/${LUCIA.id}/activate`)).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar usuario' })).toBeInTheDocument();
  });
});

describe('CA-02.21 · restablecer la contraseña', () => {
  async function typePasswords(user: ReturnType<typeof userEvent.setup>, a: string, b: string) {
    await user.type(screen.getByLabelText(/^Contraseña nueva/), a);
    await user.type(screen.getByLabelText(/^Repite la contraseña nueva/), b);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
  }

  it('llama a la API, vacía los campos y muestra el aviso', async () => {
    const api = setupApi(LUCIA);
    // Con un pequeño retardo, como una petición real: el organismo vacía los campos al ver terminar
    // la petición en curso (si la respuesta llega en el mismo *render*, no la ve empezar).
    api.on(`POST /api/users/${LUCIA.id}/password`, () =>
      delayed(new Response(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));
    await saveButton();

    await typePasswords(user, 'NuevaClave2026', 'NuevaClave2026');

    expect(
      await screen.findByText(
        'Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.',
      ),
    ).toBeInTheDocument();
    const [request] = api.callsTo(`POST /api/users/${LUCIA.id}/password`);
    expect(JSON.parse(String(request?.init.body))).toEqual({ password: 'NuevaClave2026' });
    await waitFor(() => expect(screen.getByLabelText(/^Contraseña nueva/)).toHaveValue(''));
    expect(screen.getByLabelText(/^Repite la contraseña nueva/)).toHaveValue('');
  });

  it('si no coinciden, no llama a la API', async () => {
    const api = setupApi(LUCIA);
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));
    await saveButton();

    await typePasswords(user, 'NuevaClave2026', 'OtraClave2026');

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('si la API falla, muestra el error y conserva los campos', async () => {
    const api = setupApi(LUCIA);
    api.on(`POST /api/users/${LUCIA.id}/password`, () =>
      errorResponse(500, 'INTERNAL', 'Se ha producido un error inesperado.'),
    );
    const user = userEvent.setup();
    renderApp(editPath(LUCIA));
    await saveButton();

    await typePasswords(user, 'NuevaClave2026', 'NuevaClave2026');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se ha producido un error inesperado.',
    );
    expect(screen.getByLabelText(/^Contraseña nueva/)).toHaveValue('NuevaClave2026');
  });
});
