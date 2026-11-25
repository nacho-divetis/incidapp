// Comandos de base de datos: `npm run db:migrate` y `npm run db:seed`.
// Viven en el composition root porque eligen el driver a partir de la configuración.
import { makeAssignIncident } from '../application/incidents/assign-incident';
import { makeChangeIncidentStatus } from '../application/incidents/change-incident-status';
import { makeCreateIncident } from '../application/incidents/create-incident';
import type { Clock } from '../application/ports/clock';
import { createArgon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { systemClock } from '../infrastructure/clock/system-clock';
import { createDatabase, type DatabaseHandle } from '../infrastructure/db/client';
import { migrateDatabase } from '../infrastructure/db/migrate';
import { createDrizzleIncidentTypeRepository } from '../infrastructure/db/repositories/incident-type-repository';
import { seedDatabase, seedDemoIncidents, seedDemoStaff } from '../infrastructure/db/seed';
import { createDrizzleUnitOfWork } from '../infrastructure/db/unit-of-work';
import { ConfigError, loadConfig } from './config';

/**
 * `db:seed`: catálogos y usuarios demo, usuarios adicionales e incidencias demo (F07). Las
 * incidencias se cargan con los casos de uso reales, montados aquí con el reloj guionizado que les
 * pasa el *seed* (decisión 2 de la spec de F07). Los datos demo se cargan una sola vez por base
 * de datos y un fallo suyo solo deja un aviso: nunca impide arrancar la aplicación.
 */
async function seed({ db }: DatabaseHandle): Promise<void> {
  const passwordHasher = createArgon2PasswordHasher();
  const warn = (message: string) => console.warn(`IncidApp: ${message}`);
  await seedDatabase(db, { passwordHasher });
  await seedDemoStaff(db, { passwordHasher, warn });
  await seedDemoIncidents(db, {
    now: systemClock.now(),
    warn,
    useCasesWith: (clock: Clock) => {
      const deps = {
        incidentTypes: createDrizzleIncidentTypeRepository(db),
        unitOfWork: createDrizzleUnitOfWork(db),
        clock,
      };
      return {
        createIncident: makeCreateIncident(deps),
        assignIncident: makeAssignIncident(deps),
        changeIncidentStatus: makeChangeIncidentStatus(deps),
      };
    },
  });
}

const COMMANDS = {
  migrate: { run: migrateDatabase, done: 'Migraciones aplicadas.' },
  seed: { run: seed, done: 'Datos demo cargados.' },
} satisfies Record<string, { run: typeof migrateDatabase; done: string }>;

const name = process.argv[2];
if (name !== 'migrate' && name !== 'seed') {
  console.error(`Comando desconocido: usa "migrate" o "seed".`);
  process.exit(1);
}
const command = COMMANDS[name];

try {
  const config = loadConfig(process.env);
  const database = await createDatabase(config.database);
  try {
    await command.run(database);
  } finally {
    await database.close();
  }
  console.info(`IncidApp (${config.database.driver}): ${command.done}`);
} catch (error) {
  // Solo el mensaje (sin stack). Un ConfigError ya está en español y nunca incluye valores secretos.
  const message = error instanceof Error ? error.message : String(error);
  const prefix = error instanceof ConfigError ? '' : 'Error de la base de datos: ';
  console.error(`IncidApp: no se ha podido ejecutar "${name}". ${prefix}${message}`);
  process.exit(1);
}
