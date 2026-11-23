// Helper de tests de `http/`: dependencias de autenticación para los tests que no las usan
// (salud, SPA, cabeceras…). Si una de ellas llega a llamarse, el test falla con un mensaje claro.
import type { AuthDeps } from './app';

const unused = (name: string) => async (): Promise<never> => {
  throw new Error(`El caso de uso ${name} no se usa en este test.`);
};

export const unusedAuth: AuthDeps = {
  login: unused('login'),
  logout: unused('logout'),
  resolveSession: unused('resolveSession'),
  loginRateLimit: { max: 1000, timeWindowMs: 60_000 },
};
