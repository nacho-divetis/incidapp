import { defineConfig } from 'drizzle-kit';

// Solo para `npm run db:generate`: genera las migraciones a partir del esquema, sin conectarse a ninguna base de datos.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
});
