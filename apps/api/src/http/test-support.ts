// Helper de tests de `http/`: dependencias de autenticación para los tests que no las usan
// (salud, SPA, cabeceras…). Si una de ellas llega a llamarse, el test falla con un mensaje claro.
import type { Role } from '@incidapp/shared';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
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

/** Incidencias y catálogo de tipos para los tests que no los usan. */
export const unusedIncidents: Pick<AppDeps, 'incidents' | 'incidentTypes'> = {
  incidents: {
    listIncidents: unused('listIncidents'),
    getIncident: unused('getIncident'),
    createIncident: unused('createIncident'),
    updateIncident: unused('updateIncident'),
    listAssignees: unused('listAssignees'),
    assignIncident: unused('assignIncident'),
    changeIncidentStatus: unused('changeIncidentStatus'),
    listIncidentEvents: unused('listIncidentEvents'),
  },
  incidentTypes: { listIncidentTypes: unused('listIncidentTypes') },
};

/**
 * Gestión de usuarios, catálogo de departamentos e incidencias para los tests que no los usan
 * (todo salvo la autenticación y la salud).
 */
export const unusedAdmin: Pick<AppDeps, 'users' | 'departments' | 'incidents' | 'incidentTypes'> = {
  ...unusedIncidents,
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

// --- Cliente para las pruebas de autorización (T-02.04) ---------------------------------------------

export const TEST_CSRF_HEADERS = { 'x-requested-with': 'fetch' } as const;

export interface AuthzClient {
  /** Token de sesión (cookie) de cada rol, con los usuarios demo del seed. */
  tokens: Record<Role, string>;
  /** Petición con `X-Requested-With`; `token` undefined = sin sesión. */
  call(
    method: NonNullable<InjectOptions['method']>,
    url: string,
    options?: { token?: string | undefined; payload?: unknown },
  ): Promise<LightMyRequestResponse>;
}

/**
 * Cliente de pruebas sobre una app ya montada: inicia sesión con el usuario demo de cada rol y expone
 * `call` (con `X-Requested-With`). La app con infraestructura real se monta en el propio test, porque
 * las reglas de capas solo permiten a `http/` importar de `infrastructure/` en los `*.test.ts`. F03 y
 * F04 reutilizan este cliente.
 */
export async function createAuthzClient(app: FastifyInstance): Promise<AuthzClient> {
  const { DEMO_PASSWORD, DEMO_USERS } = await import('@incidapp/shared');

  const call: AuthzClient['call'] = (method, url, { token, payload } = {}) =>
    app.inject({
      method,
      url,
      headers: TEST_CSRF_HEADERS,
      remoteAddress: '203.0.113.50',
      cookies: token === undefined ? {} : { incidapp_session: token },
      ...(payload === undefined ? {} : { payload: payload as InjectOptions['payload'] }),
    });

  const tokens = {} as Record<Role, string>;
  for (const demo of DEMO_USERS) {
    const response = await call('POST', '/api/auth/login', {
      payload: { email: demo.email, password: DEMO_PASSWORD },
    });
    const token = response.cookies.find((c) => c.name === 'incidapp_session')?.value;
    if (response.statusCode !== 200 || !token) throw new Error(`Login de ${demo.role} fallido.`);
    tokens[demo.role as Role] = token;
  }
  return { tokens, call };
}
