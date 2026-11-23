import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authKeys } from '../../queries/auth';
import { HomePage } from './HomePage';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DEMO_USER = {
  id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  email: 'admin@incidapp.test',
  name: 'Elena Ruiz',
  role: 'ADMIN',
  departments: [],
} as const;

function renderHomePage() {
  // Sin reintentos: un fallo se muestra en el primer intento. La página va dentro de
  // `RequireSession`, así que el usuario ya está en la caché.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(authKeys.me, DEMO_USER);
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('HomePage', () => {
  it('saluda al usuario con sesión', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));

    renderHomePage();

    expect(screen.getByText('Hola, Elena Ruiz.')).toBeInTheDocument();
  });

  it('CA-00.7: muestra el nombre y un estado de carga mientras consulta /api/health', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));

    renderHomePage();

    expect(screen.getByRole('heading', { level: 1, name: 'IncidApp' })).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Comprobando la conexión…');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/health');
  });

  it('CA-00.7: muestra "Conectada" y la versión cuando la API responde ok', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { status: 'ok', db: 'ok', version: '0.1.0+abc1234' }),
    );

    renderHomePage();

    expect(await screen.findByText('Estado de la API: Conectada')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Versión 0.1.0+abc1234')).toBeInTheDocument();
  });

  it('CA-00.7: muestra "Sin conexión" cuando la API responde 503 (base de datos caída)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { status: 'error', db: 'error', version: '0.1.0' }),
    );

    renderHomePage();

    expect(await screen.findByText('Estado de la API: Sin conexión')).toBeInTheDocument();
    expect(screen.queryByText(/^Versión/)).not.toBeInTheDocument();
  });

  it('CA-00.7: muestra "Sin conexión" cuando la API no responde', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderHomePage();

    expect(await screen.findByText('Estado de la API: Sin conexión')).toBeInTheDocument();
  });
});
