import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Dirección de la API en desarrollo (`npm run dev -w @incidapp/api`). */
export const DEV_API_TARGET = 'http://localhost:3000';

// La reutilizan Vitest (`vitest.config.ts`) y Storybook (`.storybook/main.ts`).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Alias `@/` → `src/`, declarado en `tsconfig.json` (`paths`).
    tsconfigPaths: true,
  },
  server: {
    // En desarrollo, la web llega a la API por el mismo origen: `/api` → API local (CA-00.2).
    proxy: {
      '/api': DEV_API_TARGET,
    },
  },
  build: {
    outDir: 'dist',
  },
});
