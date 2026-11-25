// Hooks de TanStack Query de la gestión de usuarios (solo Admin, `/api/users…`).
import {
  UserAdmin,
  type CreateUserInput,
  type CurrentUser,
  type UpdateUserInput,
} from '@incidapp/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiSend } from '../lib/api/client';
import { authKeys } from './auth';

export const userKeys = {
  /** Listado (`GET /api/users`). Es también el prefijo de todas las claves de usuarios. */
  list: ['users'] as const,
  /** Un usuario (`GET /api/users/:id`). */
  detail: (id: string) => ['users', id] as const,
};

const UserAdminList = z.array(UserAdmin);

function userPath(id: string): string {
  return `/users/${encodeURIComponent(id)}`;
}

/**
 * Tras una mutación que devuelve el usuario: guarda la respuesta en su detalle, actualiza su fila del
 * listado si está en la caché e invalida el listado (solo él, no los detalles: el del usuario ya está
 * al día). Si es el usuario con sesión, vuelve a pedir `me` (nombre o email nuevos en la cabecera).
 */
function storeUser(queryClient: QueryClient, user: UserAdmin): void {
  queryClient.setQueryData(userKeys.detail(user.id), user);
  queryClient.setQueryData<UserAdmin[]>(userKeys.list, (users) =>
    users?.map((item) => (item.id === user.id ? user : item)),
  );
  void queryClient.invalidateQueries({ queryKey: userKeys.list, exact: true });
  const me = queryClient.getQueryData<CurrentUser | null>(authKeys.me);
  if (me?.id === user.id) void queryClient.invalidateQueries({ queryKey: authKeys.me });
}

/** Listado de usuarios (CA-02.18). */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list,
    queryFn: () => apiGet('/users', UserAdminList),
  });
}

/** Un usuario con sus `allowedActions` (CA-02.19 a CA-02.21). */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => apiGet(userPath(id), UserAdmin),
  });
}

/** Alta de un usuario (`POST /api/users`). */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => apiSend('POST', '/users', UserAdmin, input),
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.detail(user.id), user);
      void queryClient.invalidateQueries({ queryKey: userKeys.list, exact: true });
    },
    // Las variables llevan la contraseña inicial: la mutación sale de la caché en cuanto nadie la observa.
    gcTime: 0,
  });
}

/** Edición de un usuario (`PATCH /api/users/:id`). */
export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => apiSend('PATCH', userPath(id), UserAdmin, input),
    onSuccess: (user) => storeUser(queryClient, user),
  });
}

/** Desactivar (`false`) o reactivar (`true`) un usuario (`POST /api/users/:id/(de)activate`). */
export function useSetUserActive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) =>
      apiSend('POST', `${userPath(id)}/${active ? 'activate' : 'deactivate'}`, UserAdmin),
    onSuccess: (user) => storeUser(queryClient, user),
  });
}

/** Restablecer la contraseña de un usuario (`POST /api/users/:id/password`, responde 204). */
export function useResetUserPassword(id: string) {
  return useMutation({
    mutationFn: (password: string) =>
      apiSend('POST', `${userPath(id)}/password`, z.undefined(), { password }),
    // Las variables llevan la contraseña: la mutación sale de la caché en cuanto nadie la observa.
    gcTime: 0,
  });
}
