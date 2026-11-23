// Rutas de la web (React Router en modo librería). Cada ruta apunta a una página de `pages/`.
//
// - `/login`: solo sin sesión (con sesión, `RedirectIfAuthenticated` lleva a la ruta de vuelta).
// - Rutas protegidas: `RequireSession` (sin sesión → `/login?next=…`) + `ProtectedLayout`
//   (`AppLayout` con la cabecera del usuario).
// - Cualquier otra ruta: `NotFoundPage`, para todos.
import { createBrowserRouter, type RouteObject } from 'react-router';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedLayout } from './ProtectedLayout';
import { RedirectIfAuthenticated, RequireSession } from './guards';
import { LOGIN_PATH, loginPath } from './safe-next-path';

export const routes: RouteObject[] = [
  {
    element: <RedirectIfAuthenticated />,
    children: [{ path: LOGIN_PATH, element: <LoginPage /> }],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <ProtectedLayout />,
        children: [{ path: '/', element: <HomePage /> }],
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
