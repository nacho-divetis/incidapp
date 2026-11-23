import { useHealth } from '../../queries/health';

/** Página inicial: nombre de la aplicación y estado de la conexión con la API. */
export function HomePage() {
  const health = useHealth();

  let apiStatus: string;
  if (health.isPending) apiStatus = 'Comprobando la conexión…';
  else if (health.data?.status === 'ok') apiStatus = 'Conectada';
  else apiStatus = 'Sin conexión';

  return (
    <main>
      <h1>IncidApp</h1>
      <p role="status" aria-busy={health.isPending}>
        Estado de la API: {apiStatus}
      </p>
      {health.data?.status === 'ok' && <p>Versión {health.data.version}</p>}
    </main>
  );
}
