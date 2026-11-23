// Providers globales de la web: caché de datos (TanStack Query) y reacción a la sesión caducada.
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api/client';
import { authKeys, resetSessionCache } from '../queries/auth';

const MAX_RETRIES = 2;

export interface CreateQueryClientOptions {
  /**
   * Se llama cuando una petición responde 401 durante el uso (sesión caducada o revocada), después
   * de vaciar la caché. La aplicación navega aquí a `/login` (CA-01.16).
   */
  onSessionExpired?: () => void;
}

function sameKey(key: QueryKey | undefined, expected: QueryKey): boolean {
  return key !== undefined && JSON.stringify(key) === JSON.stringify(expected);
}

/**
 * `QueryClient` de la aplicación.
 *
 * - No reintenta los errores 4xx, que no se arreglan repitiendo.
 * - Un 401 de cualquier *query* o mutación vacía la caché y llama a `onSessionExpired`. Se excluyen
 *   `me` (que convierte su 401 en `null`) y el login (su 401 es "credenciales incorrectas").
 */
export function createQueryClient({
  onSessionExpired,
}: CreateQueryClientOptions = {}): QueryClient {
  function handleError(error: unknown, key: QueryKey | undefined) {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    if (sameKey(key, authKeys.me) || sameKey(key, authKeys.login)) return;
    resetSessionCache(queryClient);
    onSessionExpired?.();
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleError(error, query.queryKey),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        handleError(error, mutation.options.mutationKey),
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < MAX_RETRIES;
        },
      },
    },
  });
  return queryClient;
}

export interface AppProvidersProps extends CreateQueryClientOptions {
  children: ReactNode;
}

export function AppProviders({ children, onSessionExpired }: AppProvidersProps) {
  const [queryClient] = useState(() => createQueryClient({ onSessionExpired }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
