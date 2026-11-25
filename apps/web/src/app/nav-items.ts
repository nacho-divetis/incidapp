// Enlaces de la navegación principal según las acciones globales del usuario (CA-02.16).
import type { GlobalAction } from '@incidapp/shared';
import type { MainNavItem } from '../components/organisms';
import { HOME_PATH, USERS_PATH } from './paths';

interface NavEntry {
  label: string;
  href: string;
  icon: MainNavItem['icon'];
  /** Acción global que hace falta para ver el enlace; sin ella, lo ve cualquiera con sesión. */
  requires?: GlobalAction;
  /** El enlace es el actual también en sus subrutas (p. ej. la edición de un usuario). */
  matchSubpaths: boolean;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: 'Inicio', href: HOME_PATH, icon: 'inbox', matchSubpaths: false },
  {
    label: 'Usuarios',
    href: USERS_PATH,
    icon: 'users',
    requires: 'manageUsers',
    matchSubpaths: true,
  },
];

function isCurrent(entry: NavEntry, pathname: string): boolean {
  if (pathname === entry.href) return true;
  return entry.matchSubpaths && pathname.startsWith(`${entry.href}/`);
}

/**
 * Enlaces que ve el usuario: "Inicio" siempre y "Usuarios" solo con `manageUsers`. Decide solo con
 * `allowedActions` (las calcula la API), nunca con el rol. Marca como actual el de `pathname`.
 */
export function navItemsFor(
  allowedActions: readonly GlobalAction[],
  pathname: string,
): MainNavItem[] {
  return NAV_ENTRIES.filter(
    (entry) => !entry.requires || allowedActions.includes(entry.requires),
  ).map((entry) => ({
    label: entry.label,
    href: entry.href,
    icon: entry.icon,
    current: isCurrent(entry, pathname),
  }));
}
