import { defineConfig } from 'vitest/config';

// PGlite (en memoria o en disco) puede tardar más de los 5 s por defecto en arrancar y migrar,
// sobre todo en la CI: se amplía el margen para evitar fallos intermitentes por lentitud.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
