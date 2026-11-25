// Layout de las rutas con sesión: `AppLayout` con la cabecera del usuario, la navegación principal y
// la página en `<Outlet />`.
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Alert } from '../components/molecules';
import { AppHeader, MainNav } from '../components/organisms';
import { AppLayout } from '../components/templates';
import { useCurrentUser, useLogout } from '../queries/auth';
import { navItemsFor } from './nav-items';
import { LOGIN_PATH } from './safe-next-path';

export const APP_NAME = 'IncidApp';

/**
 * Va dentro de `RequireSession`, así que el usuario ya está en la caché. "Cerrar sesión" (CA-01.15)
 * llama a la API, vacía la caché (lo hace `useLogout`) y navega a `/login` sustituyendo la entrada
 * del historial. Si el cierre falla, se queda en la página y lo avisa.
 *
 * La navegación (CA-02.16) sale de `navItemsFor`, que decide con `allowedActions` y la ruta actual.
 */
export function ProtectedLayout() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      return; // El aviso sale de `logout.isError`.
    }
    void navigate(LOGIN_PATH, { replace: true });
  }

  if (!user) return null;

  return (
    <AppLayout
      header={
        <AppHeader
          appName={APP_NAME}
          user={user}
          onLogout={() => void handleLogout()}
          isLoggingOut={logout.isPending}
        />
      }
      nav={<MainNav items={navItemsFor(user.allowedActions, pathname)} linkAs={RouterLink} />}
    >
      {logout.isError && (
        <Alert tone="danger" className="mb-4">
          No se ha podido cerrar la sesión. Inténtalo de nuevo.
        </Alert>
      )}
      <Outlet />
    </AppLayout>
  );
}
