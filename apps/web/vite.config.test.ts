import { describe, expect, it } from 'vitest';
import viteConfig, { DEV_API_TARGET } from './vite.config';

describe('configuración de Vite', () => {
  it('CA-00.2: en desarrollo, `/api` se redirige a la API local en el puerto 3000', () => {
    expect(DEV_API_TARGET).toBe('http://localhost:3000');
    expect(viteConfig.server?.proxy?.['/api']).toBe(DEV_API_TARGET);
  });
});
