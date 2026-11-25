// CA-02.19 (alta): formulario con `fetch` simulado (rutas y providers reales).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_ADMIN, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import { renderApp } from '../../test/render-app';
import { DEPARTMENTS, LUCIA } from '../../test/user-fixtures';

const ME = 'GET /api/auth/me';
const DEPARTMENTS_GET = 'GET /api/departments';
const CREATE = 'POST /api/users';
const PATH = '/admin/usuarios/nuevo';

function fields() {
  return {
    name: screen.getByRole('textbox', { name: /nombre/i }),
    email: screen.getByRole('textbox', { name: /email/i }),
    role: screen.getByRole('combobox', { name: /rol/i }),
    password: screen.getByLabelText(/contraseña inicial/i),
  };
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  const form = fields();
  await user.type(form.name, LUCIA.name);
  await user.type(form.email, LUCIA.email);
  await user.selectOptions(form.role, 'MANAGER');
  await user.click(screen.getByRole('checkbox', { name: 'Logística (LOG)' }));
  await user.click(screen.getByRole('checkbox', { name: 'Mantenimiento (MNT)' }));
  await user.type(form.password, 'Segura2026!');
}

function setupApi() {
  return mockApi({
    [ME]: () => jsonResponse(200, DEMO_ADMIN),
    [DEPARTMENTS_GET]: () => jsonResponse(200, DEPARTMENTS),
  });
}

describe('CA-02.19 · alta de usuario', () => {
  it('mientras carga el catálogo muestra un indicador', async () => {
    mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), [DEPARTMENTS_GET]: never });

    renderApp(PATH);

    expect(await screen.findByText('Cargando el formulario…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument();
  });

  it('muestra los departamentos como casillas y la contraseña inicial', async () => {
    setupApi();

    renderApp(PATH);

    const group = await screen.findByRole('group', { name: /departamentos/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(DEPARTMENTS.length);
    expect(within(group).getByRole('checkbox', { name: 'Logística (LOG)' })).not.toBeChecked();
    expect(fields().password).toHaveAttribute('type', 'password');
  });

  it('valida en el cliente con los errores junto a cada campo, sin llamar a la API', async () => {
    const api = setupApi();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole('button', { name: 'Crear usuario' }));

    const { name, password } = fields();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/El nombre es obligatorio\./);
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Selecciona al menos un departamento.')).toBeInTheDocument();
    expect(api.callsTo(CREATE)).toHaveLength(0);
  });

  it('al crear, envía los datos y vuelve al listado con los datos nuevos y un aviso de éxito', async () => {
    const api = setupApi();
    api.on(CREATE, () => jsonResponse(201, LUCIA));
    api.on('GET /api/users', () => jsonResponse(200, [LUCIA]));
    const user = userEvent.setup();
    const { currentPath } = renderApp(PATH);
    await screen.findByRole('button', { name: 'Crear usuario' });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Usuario Lucía Gil creado.')).toBeInTheDocument();
    expect(currentPath()).toBe('/admin/usuarios');
    expect(await screen.findByRole('link', { name: 'Lucía Gil' })).toBeInTheDocument();
    const [request] = api.callsTo(CREATE);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      email: LUCIA.email,
      name: LUCIA.name,
      role: 'MANAGER',
      departmentIds: [DEPARTMENTS[1]!.id, DEPARTMENTS[2]!.id],
      password: 'Segura2026!',
    });
    expect(request?.init.headers).toMatchObject({ 'X-Requested-With': 'fetch' });
  });

  it('un 409 por email repetido se muestra junto al campo "Email" y se queda en el alta', async () => {
    const api = setupApi();
    api.on(CREATE, () => errorResponse(409, 'CONFLICT', 'Ya existe un usuario con ese email.'));
    const user = userEvent.setup();
    const { currentPath } = renderApp(PATH);
    await screen.findByRole('button', { name: 'Crear usuario' });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    const { email } = fields();
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/Ya existe un usuario con ese email\./);
    expect(email).toHaveFocus();
    expect(screen.queryByRole('alert', { name: /Ya existe/ })).not.toBeInTheDocument();
    expect(currentPath()).toBe(PATH);
  });

  it('un 400 de departamentos va junto a las casillas', async () => {
    const api = setupApi();
    api.on(CREATE, () =>
      jsonResponse(400, {
        error: {
          code: 'VALIDATION',
          message: 'Los datos enviados no son válidos.',
          details: [{ path: 'departmentIds', message: 'Algún departamento no existe.' }],
        },
      }),
    );
    const user = userEvent.setup();
    renderApp(PATH);
    await screen.findByRole('button', { name: 'Crear usuario' });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Algún departamento no existe.')).toBeInTheDocument();
    expect(screen.queryByText('Los datos enviados no son válidos.')).not.toBeInTheDocument();
  });

  it('otro error de la API se muestra en un `Alert` del formulario', async () => {
    const api = setupApi();
    api.on(CREATE, () => errorResponse(500, 'INTERNAL', 'Se ha producido un error inesperado.'));
    const user = userEvent.setup();
    renderApp(PATH);
    await screen.findByRole('button', { name: 'Crear usuario' });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se ha producido un error inesperado.',
    );
  });

  it('"Cancelar" vuelve al listado', async () => {
    const api = setupApi();
    api.on('GET /api/users', never);
    const user = userEvent.setup();
    const { currentPath } = renderApp(PATH);

    await user.click(await screen.findByRole('link', { name: 'Cancelar' }));

    expect(currentPath()).toBe('/admin/usuarios');
  });
});
