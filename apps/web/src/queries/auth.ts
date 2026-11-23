// Hooks de TanStack Query de la autenticación: usuario actual, inicio y cierre de sesión.
import { CurrentUser, type LoginInput } from '@incidapp/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, apiGet, apiSend } from '../lib/api/client';

export const authKeys = {
  /** Usuario actual (`GET /api/auth/me`): `CurrentUser` con sesión, `null` sin ella. */
  me: ['auth', 'me'] as const,
  /** Mutación de inicio de sesión: su 401 es "credenciales incorrectas", no "sesión caducada". */
  login: ['auth', 'login'] as const,
  logout: ['auth', 'logout'] as const,
};

/** Usuario actual, o `null` si no hay sesión (la API responde 401). */
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await apiGet('/auth/me', CurrentUser);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Deja la caché como la de un visitante sin sesión: sin datos y con el usuario actual a `null`. */
export function resetSessionCache(queryClient: QueryClient): void {
  queryClient.clear();
  queryClient.setQueryData(authKeys.me, null);
}

/**
 * Usuario con sesión (`GET /api/auth/me`). Un 401 no es un error: devuelve `null`. El resultado no
 * caduca solo (la sesión dura 7 días): se actualiza al iniciar o cerrar sesión, y cualquier 401 de
 * otra petición vacía la caché (ver `createQueryClient`).
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
  });
}

/** Inicio de sesión (`POST /api/auth/login`). Al terminar, guarda el usuario en la caché de `me`. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: authKeys.login,
    mutationFn: (input: LoginInput) => apiSend('POST', '/auth/login', CurrentUser, input),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
    // Las variables llevan la contraseña: la mutación sale de la caché en cuanto nadie la observa.
    gcTime: 0,
  });
}

/**
 * Cierre de sesión (`POST /api/auth/logout`, sin cuerpo ni `Content-Type`). Al terminar, vacía la
 * caché de datos del cliente y deja el usuario actual a `null`. Navegar a `/login` es cosa de la
 * página o del layout que lo llama.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: authKeys.logout,
    mutationFn: () => apiSend('POST', '/auth/logout', z.undefined()),
    onSuccess: () => {
      resetSessionCache(queryClient);
    },
  });
}
