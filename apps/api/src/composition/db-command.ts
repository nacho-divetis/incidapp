// Comandos de base de datos: `npm run db:migrate` y `npm run db:seed`.
// Viven en el composition root porque eligen el driver a partir de la configuración.
import { createDatabase } from '../infrastructure/db/client';
import { migrateDatabase } from '../infrastructure/db/migrate';
import { seedDatabase } from '../infrastructure/db/seed';
import { ConfigError, loadConfig } from './config';

const COMMANDS = {
  migrate: { run: migrateDatabase, done: 'Migraciones aplicadas.' },
  seed: { run: (handle) => seedDatabase(handle.db), done: 'Datos demo cargados.' },
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
