// Punto de entrada de la API: configuración → dependencias → servidor, con cierre ordenado.
// Las migraciones y el seed no se ejecutan aquí, sino antes con `npm run db:migrate` (y `db:seed`).
import { buildApp } from '../http/app';
import { ConfigError, loadConfig, type Config } from './config';
import { createContainer } from './container';

function readConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`IncidApp API: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const container = await createContainer(config);
const app = await buildApp({
  getHealth: container.getHealth,
  auth: container.auth,
  users: container.users,
  departments: container.departments,
  incidentTypes: container.incidentTypes,
  incidents: container.incidents,
  webDistDir: config.webDistDir,
  enforceHttps: config.enforceHttps,
  trustProxyHops: config.trustProxyHops,
  logger: config.nodeEnv === 'test' ? false : { level: 'info' },
});
app.addHook('onClose', () => container.close());

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info(`Señal ${signal} recibida: cerrando el servidor.`);
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'Error al cerrar el servidor');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error({ err: error }, 'No se ha podido arrancar el servidor');
  await container.close();
  process.exit(1);
}
