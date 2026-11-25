// CA-01.17 · Página no encontrada (la navegación desde el enlace se prueba en `app/router.test.tsx`).
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('muestra "Página no encontrada" y un enlace a la página de inicio, sin pedir nada a la API', () => {
    const router = createMemoryRouter([{ path: '*', element: <NotFoundPage /> }], {
      initialEntries: ['/no-existe'],
    });

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    // La página de inicio es el listado de incidencias (CA-07.5).
    expect(screen.getByRole('link', { name: 'Volver a la página de inicio' })).toHaveAttribute(
      'href',
      '/incidencias',
    );
  });
});
