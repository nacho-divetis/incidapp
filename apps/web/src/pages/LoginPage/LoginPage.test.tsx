// CA-01.13 · Página de inicio de sesión (y el aviso de CA-01.16), montada con las rutas reales.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DEMO_ADMIN,
  errorResponse,
  jsonResponse,
  mockApi,
  never,
  unauthorized,
} from '../../test/api-mock';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const LOGIN = 'POST /api/auth/login';

async function openLogin(path = '/login') {
  const view = renderApp(path);
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  return view;
}

const emailInput = () => screen.getByLabelText(/^Email/);
const passwordInput = () => screen.getByLabelText(/^Contraseña/);
const submitButton = () => screen.getByRole('button', { name: 'Iniciar sesión' });

describe('LoginPage', () => {
  it('muestra el formulario dentro de AuthLayout, con los campos etiquetados', async () => {
    mockApi({ [ME]: unauthorized });

    await openLogin();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    expect(emailInput()).toHaveAttribute('type', 'email');
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('heading', { name: 'Usuarios demo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('valida en el cliente con el esquema de shared, sin llamar a la API', async () => {
    const api = mockApi({ [ME]: unauthorized });
    const user = userEvent.setup();
    await openLogin();

    await user.type(emailInput(), 'no-es-un-email');
    await user.click(submitButton());

    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput()).toHaveAccessibleDescription('El email no es válido.');
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo(LOGIN)).toHaveLength(0);
  });

  it('mientras espera la respuesta, el botón está en carga y no se reenvía', async () => {
    const api = mockApi({ [ME]: unauthorized, [LOGIN]: never });
    const user = userEvent.setup();
    await openLogin();

    await user.type(emailInput(), DEMO_ADMIN.email);
    await user.type(passwordInput(), 'Demo2026!');
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    await user.type(passwordInput(), '{Enter}');
    expect(api.callsTo(LOGIN)).toHaveLength(1);
  });

  it.each([
    [401, 'UNAUTHORIZED', 'Email o contraseña incorrectos.'],
    [
      429,
      'TOO_MANY_REQUESTS',
      'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en unos minutos.',
    ],
    [500, 'INTERNAL', 'Se ha producido un error inesperado.'],
  ])(
    'si la API responde %i, muestra su mensaje en role="alert" sin vaciar el email',
    async (status, code, message) => {
      mockApi({ [ME]: unauthorized, [LOGIN]: () => errorResponse(status, code, message) });
      const user = userEvent.setup();
      const { currentPath } = await openLogin();

      await user.type(emailInput(), DEMO_ADMIN.email);
      await user.type(passwordInput(), 'Demo2026!');
      await user.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(emailInput()).toHaveValue(DEMO_ADMIN.email);
      expect(submitButton()).toBeEnabled();
      expect(currentPath()).toBe('/login');
    },
  );

  it('si no hay conexión, lo dice en español', async () => {
    const api = mockApi({ [ME]: unauthorized });
    const user = userEvent.setup();
    await openLogin();
    api.on(LOGIN, () => Promise.reject(new TypeError('Failed to fetch')));

    await user.type(emailInput(), DEMO_ADMIN.email);
    await user.type(passwordInput(), 'Demo2026!');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido conectar con el servidor. Inténtalo de nuevo.',
    );
  });

  it('el recuadro de usuarios demo rellena el email y permite entrar con la contraseña demo', async () => {
    const api = mockApi({ [ME]: unauthorized, [LOGIN]: () => jsonResponse(200, DEMO_ADMIN) });
    const user = userEvent.setup();
    await openLogin();

    expect(screen.getByText('Demo2026!')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Usar la cuenta de Carmen Vidal (Responsable)' }),
    );
    expect(emailInput()).toHaveValue('responsable@incidapp.test');

    await user.type(passwordInput(), 'Demo2026!');
    await user.click(submitButton());

    await waitFor(() => expect(api.callsTo(LOGIN)).toHaveLength(1));
    expect(api.callsTo(LOGIN)[0]?.init.body).toBe(
      JSON.stringify({ email: 'responsable@incidapp.test', password: 'Demo2026!' }),
    );
  });

  it('con expired=1 muestra el aviso de sesión caducada', async () => {
    mockApi({ [ME]: unauthorized });

    await openLogin('/login?expired=1');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    );
  });
});
