// CA-03.14 (404 del detalle) · IncidentLoadError: "Incidencia no encontrada." u otro error, con un
// enlace al listado.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IncidentLoadError } from './IncidentLoadError';

describe('IncidentLoadError', () => {
  it('CA-03.14: con un 404 muestra "Incidencia no encontrada." y no el mensaje', () => {
    render(
      <IncidentLoadError
        notFound
        title="Incidencia"
        errorMessage="No existe la incidencia o no tienes acceso."
        backHref="/incidencias"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Incidencia no encontrada.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al listado de incidencias' })).toHaveAttribute(
      'href',
      '/incidencias',
    );
  });

  it('con otro error muestra el título de la página y el mensaje en un aviso', () => {
    render(
      <IncidentLoadError
        notFound={false}
        title="Editar incidencia"
        errorMessage="Se ha producido un error inesperado."
        backHref="/incidencias"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Editar incidencia' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Se ha producido un error inesperado.');
  });

  it('usa el enlace del enrutador con `linkAs` (destino en `to`)', () => {
    function FakeRouterLink({ to, ...props }: { to: string }) {
      return <a data-router-link="" href={`#${to}`} {...props} />;
    }
    render(
      <IncidentLoadError
        notFound
        title="Incidencia"
        backHref="/incidencias"
        linkAs={FakeRouterLink}
      />,
    );

    expect(screen.getByRole('link', { name: 'Volver al listado de incidencias' })).toHaveAttribute(
      'href',
      '#/incidencias',
    );
  });
});
