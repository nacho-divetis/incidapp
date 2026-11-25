// CA-02.18 (tabla de usuarios) · UserTable: tabla accesible con cabeceras, nombre con enlace a la
// edición, rol en español, departamentos, estado "Activo"/"Desactivado" y estado vacío.
import type { UserAdmin } from '@incidapp/shared';
import { render, screen, within } from '@testing-library/react';
import type { ComponentPropsWithRef } from 'react';
import { describe, expect, it } from 'vitest';
import { UserTable } from './UserTable';

/** Componente de enlace ficticio con la forma del `Link` de React Router (`to` en lugar de `href`). */
function FakeRouterLink({
  to,
  ...props
}: { to: string } & Omit<ComponentPropsWithRef<'a'>, 'href'>) {
  return <a href={to} data-router-link="" {...props} />;
}

const LOG = {
  id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a01',
  code: 'LOG',
  name: 'Logística y Almacén',
};
const COM = { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a02', code: 'COM', name: 'Comercial' };

const USERS: UserAdmin[] = [
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a01',
    email: 'marta.gil@incidapp.test',
    name: 'Marta Gil',
    role: 'MANAGER',
    active: true,
    departments: [LOG, COM],
    createdAt: '2026-11-20T09:30:00.000Z',
    allowedActions: ['rename', 'changeEmail', 'changeRole', 'changeDepartments', 'deactivate'],
  },
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a02',
    email: 'luis.navarro@incidapp.test',
    name: 'Luis Navarro',
    role: 'USER',
    active: false,
    departments: [COM],
    createdAt: '2026-11-21T10:00:00.000Z',
    allowedActions: ['rename', 'activate'],
  },
];

const editHref = (id: string) => `/admin/usuarios/${id}`;

describe('UserTable', () => {
  it('CA-02.18: es una tabla con nombre accesible y cabeceras de columna', () => {
    render(<UserTable users={USERS} getEditHref={editHref} />);

    const table = screen.getByRole('table', { name: 'Usuarios' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Nombre',
      'Email',
      'Rol',
      'Departamentos',
      'Estado',
    ]);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
  });

  it('CA-02.18: cada fila muestra nombre, email, rol en español, departamentos y estado', () => {
    render(<UserTable users={USERS} getEditHref={editHref} />);

    const [, marta, luis] = screen.getAllByRole('row');
    expect(within(marta!).getByRole('rowheader')).toHaveTextContent('Marta Gil');
    const martaCells = within(marta!).getAllByRole('cell');
    expect(martaCells[0]).toHaveTextContent('marta.gil@incidapp.test');
    expect(martaCells[1]).toHaveTextContent('Responsable');
    expect(martaCells[3]).toHaveTextContent('Activo');

    const luisCells = within(luis!).getAllByRole('cell');
    expect(luisCells[1]).toHaveTextContent('Usuario');
    expect(luisCells[3]).toHaveTextContent('Desactivado');
  });

  it('CA-02.18: los departamentos se ven por código y se anuncian con su nombre', () => {
    render(<UserTable users={USERS} getEditHref={editHref} />);

    const [, marta] = screen.getAllByRole('row');
    const departments = within(within(marta!).getAllByRole('cell')[2]!).getAllByRole('listitem');
    expect(departments).toHaveLength(2);
    expect(within(departments[0]!).getByText('LOG')).toHaveAttribute('aria-hidden', 'true');
    expect(within(departments[0]!).getByText('Logística y Almacén')).toHaveClass('sr-only');
    expect(departments[0]!.firstElementChild).toHaveAttribute('title', 'Logística y Almacén');
  });

  it('CA-02.18: el nombre de cada usuario es un enlace a su edición', () => {
    render(<UserTable users={USERS} getEditHref={editHref} />);

    expect(screen.getByRole('link', { name: 'Marta Gil' })).toHaveAttribute(
      'href',
      '/admin/usuarios/0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a01',
    );
    expect(screen.getByRole('link', { name: 'Luis Navarro' })).toHaveAttribute(
      'href',
      '/admin/usuarios/0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a02',
    );
  });

  it('con linkAs usa el enlace del enrutador con el destino en "to"', () => {
    render(<UserTable users={USERS} getEditHref={editHref} linkAs={FakeRouterLink} />);

    const link = screen.getByRole('link', { name: 'Marta Gil' });
    expect(link).toHaveAttribute('data-router-link');
    expect(link).toHaveAttribute('href', '/admin/usuarios/0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a01');
  });

  it('sin usuarios muestra el mensaje de vacío en lugar de la tabla', () => {
    render(<UserTable users={[]} getEditHref={editHref} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no hay usuarios.')).toBeInTheDocument();
  });

  it('un usuario sin departamentos lo indica con texto', () => {
    render(<UserTable users={[{ ...USERS[0]!, departments: [] }]} getEditHref={editHref} />);
    expect(screen.getByText('Sin departamentos')).toBeInTheDocument();
  });
});
