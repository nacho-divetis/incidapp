// Layout de las rutas con sesión: `AppLayout` con la cabecera del usuario y la página en `<Outlet />`.
import { Outlet, useNavigate } from 'react-router';
import { Alert } from '../components/molecules';
import { AppHeader } from '../components/organisms';
import { AppLayout } from '../components/templates';
import { useCurrentUser, useLogout } from '../queries/auth';
import { LOGIN_PATH } from './safe-next-path';

export const APP_NAME = 'IncidApp';

/**
 * Va dentro de `RequireSession`, así que el usuario ya está en la caché. "Cerrar sesión" (CA-01.15)
 * llama a la API, vacía la caché (lo hace `useLogout`) y navega a `/login` sustituyendo la entrada
 * del historial. Si el cierre falla, se queda en la página y lo avisa.
 */
export function ProtectedLayout() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

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
