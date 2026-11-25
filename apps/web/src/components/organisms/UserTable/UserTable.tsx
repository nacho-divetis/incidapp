import type { UserAdmin } from '@incidapp/shared';
import type { ElementType } from 'react';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/labels';
import {
  Badge,
  Icon,
  Link,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
} from '../../atoms';

/** Datos de cada usuario que muestra la tabla (subconjunto de `UserAdmin` de `shared`). */
export type UserTableUser = Pick<
  UserAdmin,
  'id' | 'name' | 'email' | 'role' | 'active' | 'departments'
>;

/**
 * Tabla del listado de usuarios de la gestión de usuarios (CA-02.18).
 *
 * - Columnas: nombre (enlace a la edición del usuario), email, rol en español, departamentos y estado
 *   ("Activo" / "Desactivado"). El nombre es la cabecera de su fila (`scope="row"`).
 * - Los departamentos se muestran por su código; el nombre completo está en el `title` (al pasar el
 *   ratón) y es lo que leen los lectores de pantalla.
 * - Nombre accesible de la tabla: `caption` (oculto a la vista; el título visible es el de la página).
 * - Sin usuarios, muestra `emptyMessage` en lugar de la tabla.
 * - En móvil la tabla se desplaza dentro de su contenedor (lo hace el átomo `Table`); no hace falta
 *   `regionLabel` porque cada fila tiene un enlace que se puede enfocar.
 * - `linkAs`: componente de enlace del enrutador (el `Link` de React Router), que recibe el destino
 *   en `to`. Sin él, se pinta un `<a href>`.
 */
export interface UserTableProps {
  users: UserTableUser[];
  /** Ruta de la edición de un usuario. */
  getEditHref: (id: string) => string;
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  /** Nombre accesible de la tabla. */
  caption?: string;
  /** Mensaje cuando no hay usuarios. */
  emptyMessage?: string;
  className?: string;
}

export function UserTable({
  users,
  getEditHref,
  linkAs,
  caption = 'Usuarios',
  emptyMessage = 'Todavía no hay usuarios.',
  className,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-surface p-6',
          className,
        )}
      >
        <Icon name="users" size="lg" className="text-fg-muted" />
        <Text variant="muted">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <Table containerClassName={className}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Nombre</TableHeaderCell>
          <TableHeaderCell>Email</TableHeaderCell>
          <TableHeaderCell>Rol</TableHeaderCell>
          <TableHeaderCell>Departamentos</TableHeaderCell>
          <TableHeaderCell>Estado</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {users.map((user) => {
          const href = getEditHref(user.id);
          return (
            <TableRow key={user.id}>
              <TableHeaderCell scope="row">
                <Link {...(linkAs ? { as: linkAs, to: href } : { href })}>{user.name}</Link>
              </TableHeaderCell>
              <TableCell className="break-all">{user.email}</TableCell>
              <TableCell className="whitespace-nowrap">{ROLE_LABELS[user.role]}</TableCell>
              <TableCell>
                {user.departments.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {user.departments.map((department) => (
                      <li key={department.id}>
                        <Badge title={department.name}>
                          <span aria-hidden="true">{department.code}</span>
                          <span className="sr-only">{department.name}</span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text as="span" variant="small">
                    Sin departamentos
                  </Text>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={user.active ? 'success' : 'neutral'}>
                  {user.active ? 'Activo' : 'Desactivado'}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
