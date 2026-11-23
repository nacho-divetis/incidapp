import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El proxy de `/api` hacia la API en desarrollo se añade en T-00.04.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
