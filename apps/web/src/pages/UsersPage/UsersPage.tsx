import { Link as RouterLink } from 'react-router';
import { buttonVariants, Icon, Link, Spinner } from '../../components/atoms';
import { Alert, PageHeader } from '../../components/molecules';
import { UserTable } from '../../components/organisms';
import { useLocationNotice, type LocationNoticeState } from '../../app/location-notice';
import { USER_CREATE_PATH, userEditPath } from '../../app/paths';
import { cn } from '../../lib/cn';
import { errorMessageOf } from '../../lib/api/error-messages';
import { useUsers } from '../../queries/users';

/** Estado de navegación con el que otras páginas dejan un aviso de éxito para el listado. */
export type UsersPageLocationState = LocationNoticeState;

/**
 * Listado de la gestión de usuarios (`/admin/usuarios`, CA-02.18). Va dentro de
 * `RequireAction('manageUsers')`.
 *
 * - Cabecera con el botón "Nuevo usuario" y la tabla `UserTable` (estado vacío incluido).
 * - Mientras carga, un indicador; si la API falla, un `Alert` con el mensaje en español.
 * - Si llega un aviso de éxito en `location.state` (tras crear o editar), lo muestra y lo borra del
 *   historial, para que no reaparezca al recargar o volver atrás.
 */
export function UsersPage() {
  const users = useUsers();
  const notice = useLocationNotice();

  let content;
  if (users.isPending) {
    content = <Spinner label="Cargando usuarios…" />;
  } else if (users.isError) {
    content = <Alert tone="danger">{errorMessageOf(users.error)}</Alert>;
  } else {
    content = <UserTable users={users.data} getEditHref={userEditPath} linkAs={RouterLink} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas de la empresa, con su rol y sus departamentos."
        actions={
          <Link
            as={RouterLink}
            to={USER_CREATE_PATH}
            className={cn(
              buttonVariants(),
              'no-underline hover:bg-primary-hover hover:text-primary-contrast',
            )}
          >
            <Icon name="plus" size="md" />
            Nuevo usuario
          </Link>
        }
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      {content}
    </div>
  );
}
