// CA-02.16 (navegación) · MainNav: lista de enlaces que pinta los que recibe (sin mirar el rol),
// con `aria-current="page"` solo en el de la página actual, y compatible con el `Link` del enrutador.
import { render, screen, within } from '@testing-library/react';
import type { ComponentPropsWithRef } from 'react';
import { describe, expect, it } from 'vitest';
import { MainNav, type MainNavItem } from './MainNav';

/** Componente de enlace ficticio con la forma del `Link` de React Router (`to` en lugar de `href`). */
function FakeRouterLink({
  to,
  ...props
}: { to: string } & Omit<ComponentPropsWithRef<'a'>, 'href'>) {
  return <a href={to} data-router-link="" {...props} />;
}

const ITEMS: MainNavItem[] = [
  { label: 'Inicio', href: '/', current: false, icon: 'dashboard' },
  { label: 'Usuarios', href: '/admin/usuarios', current: true, icon: 'users' },
];

describe('MainNav', () => {
  it('CA-02.16: pinta una lista con un enlace por cada elemento, en orden', () => {
    render(<MainNav items={ITEMS} />);

    const list = screen.getByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Inicio', 'Usuarios']);
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/admin/usuarios',
    );
  });

  it('CA-02.16: solo el enlace de la página actual lleva aria-current="page"', () => {
    render(<MainNav items={ITEMS} />);

    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('CA-02.16: sin "Usuarios" en los elementos, no aparece (lo decide quien lo usa)', () => {
    render(<MainNav items={[{ label: 'Inicio', href: '/', current: true }]} />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('no repite el landmark <nav> (lo pone AppLayout)', () => {
    render(<MainNav items={ITEMS} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('con linkAs pinta el enlace del enrutador con el destino en "to"', () => {
    render(<MainNav items={ITEMS} linkAs={FakeRouterLink} />);

    const link = screen.getByRole('link', { name: 'Usuarios' });
    expect(link).toHaveAttribute('data-router-link');
    expect(link).toHaveAttribute('href', '/admin/usuarios');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('sin elementos no pinta nada', () => {
    const { container } = render(<MainNav items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
