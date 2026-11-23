// CA-00.20 · AppLayout: landmarks banner, navigation y main, y enlace de salto que lleva el foco a main.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppLayout } from './AppLayout';

function renderLayout(props: Partial<Parameters<typeof AppLayout>[0]> = {}) {
  return render(
    <AppLayout
      header={<button type="button">Menú de usuario</button>}
      nav={<a href="/incidencias">Incidencias</a>}
      {...props}
    >
      <p>Contenido de la página</p>
    </AppLayout>,
  );
}

describe('AppLayout', () => {
  it('CA-00.20: expone los landmarks banner, navigation y main con el contenido de cada hueco', () => {
    renderLayout();

    expect(screen.getByRole('banner')).toHaveTextContent('Menú de usuario');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toHaveTextContent(
      'Incidencias',
    );
    expect(screen.getByRole('main')).toHaveTextContent('Contenido de la página');
  });

  it('CA-00.20: el primer tabulador llega a "Saltar al contenido" y al pulsarlo el foco pasa a main', async () => {
    renderLayout();

    await userEvent.tab();
    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(skipLink).toHaveFocus();
    expect(skipLink).toHaveAttribute('href', `#${screen.getByRole('main').id}`);

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('CA-00.20: los textos del enlace de salto y de la navegación se pueden cambiar por props', () => {
    renderLayout({ skipLinkLabel: 'Ir al contenido', navLabel: 'Menú' });

    expect(screen.getByRole('link', { name: 'Ir al contenido' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menú' })).toBeInTheDocument();
  });

  it('CA-00.20: sin header ni nav no pinta landmarks vacíos', () => {
    render(
      <AppLayout>
        <p>Contenido</p>
      </AppLayout>,
    );

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Contenido');
  });
});
