// Guardas de ruta: según la sesión (CA-01.14) y según las acciones globales que la API devuelve en
// `allowedActions` (CA-02.17). Ninguna mira el rol.
import type { GlobalAction } from '@incidapp/shared';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { Button, Spinner } from '../components/atoms';
import { Alert } from '../components/molecules';
import { AuthLayout } from '../components/templates';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { useCurrentUser } from '../queries/auth';
import { loginPath, safeNextPath } from './safe-next-path';

/** Indicador de carga a pantalla completa mientras se comprueba la sesión (sin formulario detrás). */
function SessionCheck() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted">
      <Spinner size="lg" label="Comprobando la sesión…" />
    </div>
  );
}

/** Error al comprobar la sesión (sin conexión o error del servidor), con opción de reintentar. */
function SessionCheckError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <AuthLayout title="IncidApp">
      <Alert tone="danger" className="mb-4">
        No se ha podido comprobar la sesión. Revisa la conexión e inténtalo de nuevo.
      </Alert>
      <Button className="w-full" loading={isRetrying} onClick={onRetry}>
        Reintentar
      </Button>
    </AuthLayout>
  );
}

/**
 * Rutas que exigen sesión. Mientras se resuelve `GET /api/auth/me` muestra un indicador de carga;
 * sin sesión, lleva a `/login?next=<ruta pedida>`; con sesión, pinta la ruta hija.
 */
export function RequireSession() {
  const location = useLocation();
  const currentUser = useCurrentUser();

  if (currentUser.isPending) return <SessionCheck />;
  if (currentUser.isError) {
    return (
      <SessionCheckError
        onRetry={() => void currentUser.refetch()}
        isRetrying={currentUser.isFetching}
      />
    );
  }
  if (!currentUser.data) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loginPath({ next })} replace />;
  }
  return <Outlet />;
}

/**
 * Rutas solo para visitantes sin sesión (`/login`). Con sesión —al abrirla o justo después de
 * iniciar sesión— lleva a la ruta de `next` si es interna, o a `/`.
 */
export function RedirectIfAuthenticated() {
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();

  if (currentUser.isPending) return <SessionCheck />;
  // Si no se puede comprobar la sesión, se muestra el login: iniciar sesión también la resuelve.
  if (currentUser.data) {
    return <Navigate to={safeNextPath(searchParams.get('next'))} replace />;
  }
  return <Outlet />;
}

/**
 * Rutas que exigen una acción global (p. ej. `manageUsers`, CA-02.17). Va dentro de `RequireSession`
 * y `ProtectedLayout`, así que el usuario ya está en la caché. Si su `allowedActions` no incluye
 * `action`, pinta `ForbiddenPage` **sin montar** la página: no se pide ningún dato a la API. Ocultar
 * la página es solo usabilidad: la API vuelve a comprobar el permiso (403).
 */
export function RequireAction({ action }: { action: GlobalAction }) {
  const { data: user } = useCurrentUser();
  if (!user?.allowedActions.includes(action)) return <ForbiddenPage />;
  return <Outlet />;
}
