import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Dirección de la API en desarrollo (`npm run dev -w @incidapp/api`). */
export const DEV_API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
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
