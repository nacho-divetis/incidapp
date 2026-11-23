import { DEMO_PASSWORD, DEMO_USERS, type LoginInput } from '@incidapp/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/molecules';
import { DemoAccountsPanel, LoginForm } from '../../components/organisms';
import { AuthLayout } from '../../components/templates';
import { ApiError } from '../../lib/api/client';
import { useLogin } from '../../queries/auth';

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
const NETWORK_ERROR_MESSAGE = 'No se ha podido conectar con el servidor. Inténtalo de nuevo.';

/** Mensaje en español del error del login: el de la API (401, 429…) o uno de conexión. */
function loginErrorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

/**
 * Página `/login` (CA-01.13): formulario de inicio de sesión y recuadro de usuarios demo dentro de
 * `AuthLayout`. Con `expired=1` muestra el aviso de sesión caducada (CA-01.16). Tras un login
 * correcto, `useLogin` guarda el usuario y `RedirectIfAuthenticated` lleva a la ruta de vuelta.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  const login = useLogin();
  const [email, setEmail] = useState('');

  function submit(values: LoginInput) {
    login.mutate(values);
  }

  return (
    <AuthLayout title="Iniciar sesión">
      {sessionExpired && (
        <Alert tone="warning" className="mb-4">
          {SESSION_EXPIRED_MESSAGE}
        </Alert>
      )}
      <LoginForm
        onSubmit={submit}
        // Tras el éxito sigue bloqueado hasta que la redirección desmonta la página.
        isSubmitting={login.isPending || login.isSuccess}
        errorMessage={loginErrorMessage(login.error)}
        email={email}
        onEmailChange={setEmail}
      />
      <DemoAccountsPanel
        accounts={DEMO_USERS}
        password={DEMO_PASSWORD}
        onSelect={setEmail}
        className="mt-6"
      />
    </AuthLayout>
  );
}
