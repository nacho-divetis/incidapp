// Rutas de la web (React Router en modo librería). Cada ruta apunta a una página de `pages/`.
//
// - `/`: redirige a la página de inicio, el listado de incidencias (CA-07.5). Va fuera de
//   `RequireSession`: sin sesión, la guarda del listado lleva a `/login` sin `next`.
// - `/login`: solo sin sesión (con sesión, `RedirectIfAuthenticated` lleva a la ruta de vuelta).
// - Rutas protegidas: `RequireSession` (sin sesión → `/login?next=…`) + `ProtectedLayout`
//   (`AppLayout` con la cabecera del usuario y la navegación).
// - Gestión de usuarios (`/admin/usuarios…`): además, `RequireAction('manageUsers')`; sin la acción
//   pinta `ForbiddenPage` sin montar la página (CA-02.17).
// - Incidencias (`/incidencias…`, CA-03.12 a CA-03.15): para cualquiera con sesión; el alta exige
//   además `RequireAction('createIncident')`. El detalle y la edición deciden con las
//   `allowedActions` de la incidencia (las calcula la API).
// - Cualquier otra ruta: `NotFoundPage`, para todos.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { IncidentCreatePage } from '../pages/IncidentCreatePage';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { IncidentEditPage } from '../pages/IncidentEditPage';
import { IncidentListPage } from '../pages/IncidentListPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { UserCreatePage } from '../pages/UserCreatePage';
import { UserEditPage } from '../pages/UserEditPage';
import { UsersPage } from '../pages/UsersPage';
import { ProtectedLayout } from './ProtectedLayout';
import { RedirectIfAuthenticated, RequireAction, RequireSession } from './guards';
import { HOME_PATH, INCIDENTS_PATH, ROOT_PATH, USERS_PATH } from './paths';
import { LOGIN_PATH, loginPath } from './safe-next-path';

export const routes: RouteObject[] = [
  { path: ROOT_PATH, element: <Navigate to={HOME_PATH} replace /> },
  {
    element: <RedirectIfAuthenticated />,
    children: [{ path: LOGIN_PATH, element: <LoginPage /> }],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          {
            path: INCIDENTS_PATH,
            children: [
              { index: true, element: <IncidentListPage /> },
              {
                path: 'nueva',
                element: <RequireAction action="createIncident" />,
                children: [{ index: true, element: <IncidentCreatePage /> }],
              },
              { path: ':id', element: <IncidentDetailPage /> },
              { path: ':id/editar', element: <IncidentEditPage /> },
            ],
          },
          {
            path: USERS_PATH,
            element: <RequireAction action="manageUsers" />,
            children: [
              { index: true, element: <UsersPage /> },
              { path: 'nuevo', element: <UserCreatePage /> },
              { path: ':id', element: <UserEditPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

/** Lo que usa `createSessionExpiredHandler` del router (el de la aplicación o uno de memoria). */
export interface NavigableRouter {
  readonly state: { readonly location: { pathname: string; search: string; hash: string } };
  navigate(to: string, options?: { replace?: boolean }): unknown;
}

/**
 * Reacción a un 401 durante el uso (CA-01.16), cuando la caché ya se ha vaciado: lleva a `/login`
 * conservando la ruta actual en `next` y con `expired=1` para que se muestre el aviso. Si ya se está
 * en `/login` (varias peticiones fallan a la vez), no hace nada.
 */
export function createSessionExpiredHandler(router: NavigableRouter): () => void {
  return () => {
    const { pathname, search, hash } = router.state.location;
    if (pathname === LOGIN_PATH) return;
    void router.navigate(loginPath({ next: `${pathname}${search}${hash}`, expired: true }), {
      replace: true,
    });
  };
}

export const router = createBrowserRouter(routes);
