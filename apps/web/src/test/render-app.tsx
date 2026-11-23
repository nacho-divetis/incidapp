// Monta la aplicación completa (rutas reales, providers reales) sobre un router de memoria.
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/providers';
import { createSessionExpiredHandler, routes } from '../app/router';

/** `initialPath` puede ser una lista: el historial previo, con la última entrada como la actual. */
export function renderApp(initialPath: string | string[] = '/') {
  const initialEntries = Array.isArray(initialPath) ? initialPath : [initialPath];
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  const view = render(
    <AppProviders onSessionExpired={createSessionExpiredHandler(router)}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  /** Ruta actual con su *query string*. */
  const currentPath = () => `${router.state.location.pathname}${router.state.location.search}`;
  return { ...view, router, currentPath };
}
