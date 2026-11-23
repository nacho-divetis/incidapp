import type { Role } from './auth';

/** Usuario demo: datos ficticios para que el evaluador entre con cada rol (HU-08). */
export interface DemoUser {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  /** Códigos de los departamentos a los que pertenece (los del *seed* de departamentos). */
  readonly departmentCodes: readonly string[];
}

/**
 * Contraseña común de los usuarios demo. Es pública a propósito (datos ficticios): se muestra en
 * `/login` y en el README. Nunca se usa para ningún usuario que no sea demo.
 */
export const DEMO_PASSWORD = 'Demo2026!';

/**
 * Los cuatro usuarios demo, uno por rol, con emails del dominio reservado `incidapp.test`.
 * Única fuente para el *seed* de la API y el recuadro "Usuarios demo" de `/login`.
 */
export const DEMO_USERS: readonly DemoUser[] = [
  { email: 'admin@incidapp.test', name: 'Elena Ruiz', role: 'ADMIN', departmentCodes: ['ADM'] },
  {
    email: 'direccion@incidapp.test',
    name: 'Javier Ortega',
    role: 'DIRECTOR',
    departmentCodes: ['DIR'],
  },
  {
    email: 'responsable@incidapp.test',
    name: 'Carmen Vidal',
    role: 'MANAGER',
    departmentCodes: ['LOG'],
  },
  { email: 'usuario@incidapp.test', name: 'Pablo Moreno', role: 'USER', departmentCodes: ['LOG'] },
];
