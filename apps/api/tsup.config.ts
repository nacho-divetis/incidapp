import { defineConfig } from 'tsup';

// Empaqueta la API en un único `dist/main.js` ejecutable con `node`.
// `@incidapp/shared` (sin build propio) se incluye en el bundle; las dependencias de npm quedan externas.
export default defineConfig({
  entry: { main: 'src/composition/main.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@incidapp/shared'],
});
