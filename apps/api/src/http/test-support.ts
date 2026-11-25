// Helper de tests de `http/`: dependencias de autenticación para los tests que no las usan
// (salud, SPA, cabeceras…). Si una de ellas llega a llamarse, el test falla con un mensaje claro.
import type { AppDeps, AuthDeps } from './app';

const unused = (name: string) => async (): Promise<never> => {
  throw new Error(`El caso de uso ${name} no se usa en este test.`);
};

export const unusedAuth: AuthDeps = {
  login: unused('login'),
  logout: unused('logout'),
  resolveSession: unused('resolveSession'),
  loginRateLimit: { max: 1000, timeWindowMs: 60_000 },
};

/** Gestión de usuarios y catálogo de departamentos para los tests que no los usan. */
export const unusedAdmin: Pick<AppDeps, 'users' | 'departments'> = {
  users: {
    listUsers: unused('listUsers'),
    getUser: unused('getUser'),
    createUser: unused('createUser'),
    updateUser: unused('updateUser'),
    setUserActive: unused('setUserActive'),
    resetUserPassword: unused('resetUserPassword'),
  },
  departments: { listDepartments: unused('listDepartments') },
};
