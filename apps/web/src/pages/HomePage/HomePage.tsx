import { Heading, Text } from '../../components/atoms';
import { useCurrentUser } from '../../queries/auth';
import { useHealth } from '../../queries/health';

/**
 * Página inicial (`/`, con sesión): nombre de la aplicación, saludo al usuario y estado de la
 * conexión con la API. Va dentro de `ProtectedLayout`, que ya pone el `<main>` de `AppLayout`.
 */
export function HomePage() {
  const health = useHealth();
  const { data: user } = useCurrentUser();

  let apiStatus: string;
  if (health.isPending) apiStatus = 'Comprobando la conexión…';
  else if (health.data?.status === 'ok') apiStatus = 'Conectada';
  else apiStatus = 'Sin conexión';

  return (
    <>
      <Heading level={1}>IncidApp</Heading>
      {user && <Text className="mt-2">Hola, {user.name}.</Text>}
      <Text role="status" aria-busy={health.isPending} className="mt-4">
        Estado de la API: {apiStatus}
      </Text>
      {health.data?.status === 'ok' && <Text variant="small">Versión {health.data.version}</Text>}
    </>
  );
}
