// Rutas de la aplicación de punta a punta con `fetch` simulado: guardas (CA-01.14), cabecera y
// cierre de sesión (CA-01.15), sesión caducada durante el uso (CA-01.16) y página 404 (CA-01.17).
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DEMO_ADMIN,
  HEALTH_OK,
  errorResponse,
  jsonResponse,
  mockApi,
  never,
  unauthorized,
} from '../test/api-mock';
import { renderApp } from '../test/render-app';
import { createSessionExpiredHandler } from './router';

const ME = 'GET /api/auth/me';
const LOGIN = 'POST /api/auth/login';
const LOGOUT = 'POST /api/auth/logout';
const HEALTH = 'GET /api/health';

/** Rellena el formulario de login y lo envía. */
async function logIn(user: ReturnType<typeof userEvent.setup>, password = 'Demo2026!') {
  await user.type(screen.getByLabelText(/^Email/), 'admin@incidapp.test');
  await user.type(screen.getByLabelText(/^Contraseña/), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('CA-01.14 · rutas protegidas', () => {
  it('muestra un indicador de carga, sin formulario ni contenido, mientras se comprueba la sesión', () => {
    mockApi({ [ME]: never });

    renderApp('/');

    expect(screen.getByRole('status')).toHaveTextContent('Comprobando la sesión…');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IncidApp' })).not.toBeInTheDocument();
  });

  it('sin sesión, lleva a /login con la ruta pedida en `next`', async () => {
    mockApi({ [ME]: unauthorized });

    const { currentPath } = renderApp('/?vista=lista');

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login?next=%2F%3Fvista%3Dlista');
  });

  it('tras iniciar sesión vuelve a la ruta pedida', async () => {
    const api = mockApi({
      [ME]: unauthorized,
      [LOGIN]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/login?next=%2F%3Fvista%3Dlista');

    await screen.findByRole('button', { name: 'Iniciar sesión' });
    await logIn(user);

    expect(await screen.findByRole('heading', { level: 1, name: 'IncidApp' })).toBeInTheDocument();
    expect(currentPath()).toBe('/?vista=lista');
    expect(api.callsTo(ME)).toHaveLength(1); // el usuario del login se reutiliza
  });

  it('tras iniciar sesión sin ruta pedida va a /', async () => {
    mockApi({
      [ME]: unauthorized,
      [LOGIN]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/login');

    await screen.findByRole('button', { name: 'Iniciar sesión' });
    await logIn(user);

    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('no sigue un `next` externo (open redirect): va a /', async () => {
    mockApi({
      [ME]: unauthorized,
      [LOGIN]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/login?next=%2F%2Fotro.example%2Fphishing');

    await screen.findByRole('button', { name: 'Iniciar sesión' });
    await logIn(user);

    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('con sesión, abrir /login lleva a /', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });

    const { currentPath } = renderApp('/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'IncidApp' })).toBeInTheDocument();
    expect(currentPath()).toBe('/');
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('si no se puede comprobar la sesión, lo avisa y permite reintentar', async () => {
    const api = mockApi({ [ME]: () => errorResponse(500, 'INTERNAL', 'Error.') });
    const user = userEvent.setup();
    renderApp('/');

    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent('No se ha podido comprobar la sesión');

    api.on(ME, () => jsonResponse(200, DEMO_ADMIN));
    api.on(HEALTH, () => jsonResponse(200, HEALTH_OK));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'IncidApp' })).toBeInTheDocument();
  }, 10_000); // `me` con 5xx se reintenta dos veces (1 s + 2 s) antes de dar el error.
});

describe('CA-01.15 · cabecera y cierre de sesión', () => {
  it('la cabecera muestra el nombre, el rol en español y "Cerrar sesión"', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });

    renderApp('/');

    const banner = await screen.findByRole('banner');
    expect(within(banner).getByText('Elena Ruiz')).toBeInTheDocument();
    expect(within(banner).getByText('Admin')).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    // La página va dentro del único `main` de `AppLayout`.
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByText('Hola, Elena Ruiz.')).toBeInTheDocument();
  });

  it('llama a la API, vacía la caché, navega a /login y "atrás" no muestra datos de la sesión', async () => {
    const api = mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
      [LOGOUT]: () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    // Historial: otra página con sesión antes de la actual.
    const { router, currentPath } = renderApp(['/?vista=anterior', '/']);
    await screen.findByText('Hola, Elena Ruiz.');

    // A partir de aquí, la sesión ya no existe en el servidor.
    api.on(ME, unauthorized);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
    const [logout] = api.callsTo(LOGOUT);
    expect(logout?.init.headers).toMatchObject({ 'X-Requested-With': 'fetch' });
    expect(logout?.init.headers).not.toHaveProperty('Content-Type');
    expect(logout?.init.body).toBeUndefined();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument(); // sin la cabecera del usuario
    // El usuario se dejó a `null` en la caché: no hace falta volver a preguntar a la API.
    expect(api.callsTo(ME)).toHaveLength(1);

    await act(() => router.navigate(-1));

    // La página anterior exige sesión: vuelve al login sin pintar nada de la sesión cerrada.
    await waitFor(() => expect(currentPath()).toBe('/login?next=%2F%3Fvista%3Danterior'));
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument(); // sin la cabecera del usuario
    expect(screen.queryByText(/Estado de la API/)).not.toBeInTheDocument();
  });

  it('si el cierre de sesión falla, se queda en la página y lo avisa', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
      [LOGOUT]: () => errorResponse(500, 'INTERNAL', 'Error.'),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/');
    await screen.findByText('Hola, Elena Ruiz.');

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido cerrar la sesión. Inténtalo de nuevo.',
    );
    expect(currentPath()).toBe('/');
    expect(screen.getByText('Hola, Elena Ruiz.')).toBeInTheDocument();
  });
});

describe('CA-01.16 · sesión caducada durante el uso', () => {
  it('un 401 de cualquier petición vacía la caché y lleva a /login con la ruta y el aviso', async () => {
    const api = mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), [HEALTH]: unauthorized });

    const { currentPath } = renderApp('/?vista=lista');

    expect(
      await screen.findByText(
        'Tu sesión ha caducado. Vuelve a iniciar sesión.',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login?next=%2F%3Fvista%3Dlista&expired=1');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument(); // sin la cabecera del usuario
    // La caché quedó sin sesión: el login no vuelve a pedir `me`.
    expect(api.callsTo(ME)).toHaveLength(1);
  });

  it('tras volver a iniciar sesión, regresa a la ruta en la que estaba', async () => {
    const api = mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), [HEALTH]: unauthorized });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/?vista=lista');
    await screen.findByText('Tu sesión ha caducado. Vuelve a iniciar sesión.');

    api.on(LOGIN, () => jsonResponse(200, DEMO_ADMIN));
    api.on(HEALTH, () => jsonResponse(200, HEALTH_OK));
    await logIn(user);

    expect(await screen.findByText('Estado de la API: Conectada')).toBeInTheDocument();
    expect(currentPath()).toBe('/?vista=lista');
  });

  it('el handler no navega si ya se está en /login (varios 401 a la vez)', () => {
    const navigations: string[] = [];
    const handler = createSessionExpiredHandler({
      state: { location: { pathname: '/login', search: '?expired=1', hash: '' } },
      navigate: (to) => navigations.push(to),
    });

    handler();

    expect(navigations).toEqual([]);
  });

  it('el handler conserva la ruta, la *query* y el ancla', () => {
    const navigations: Array<[string, unknown]> = [];
    const handler = createSessionExpiredHandler({
      state: { location: { pathname: '/incidencias', search: '?p=2', hash: '#fila' } },
      navigate: (to, options) => navigations.push([to, options]),
    });

    handler();

    expect(navigations).toEqual([
      ['/login?next=%2Fincidencias%3Fp%3D2%23fila&expired=1', { replace: true }],
    ]);
  });
});

describe('CA-01.17 · página no encontrada', () => {
  it('una ruta inexistente muestra "Página no encontrada" con un enlace a la página de inicio', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [HEALTH]: () => jsonResponse(200, HEALTH_OK),
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/no-existe');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Volver a la página de inicio' }));

    expect(await screen.findByText('Hola, Elena Ruiz.')).toBeInTheDocument();
    expect(currentPath()).toBe('/');
  });
});
