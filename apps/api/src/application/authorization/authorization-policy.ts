// `AuthorizationPolicy`: la única fuente de la autorización de IncidApp (ADR-009). Aplica la matriz de
// `docs/permisos.md` y calcula las `allowedActions` que devuelve la API. Funciones puras, sin puertos
// ni E/S. Ningún otro módulo compara roles: si un caso de uso necesita otra regla, se añade aquí y a
// su tabla de tests.
import {
  GlobalAction,
  isDemoUserEmail,
  UserAction,
  type CurrentUser,
  type Role,
  type Status,
} from '@incidapp/shared';

/** Quién actúa: lo necesario del usuario actual para decidir permisos. */
export interface Actor {
  id: string;
  role: Role;
  /** Ids de **sus departamentos** (`permisos.md` → Definiciones). */
  departmentIds: readonly string[];
}

/** Obtiene el `Actor` del usuario actual. */
export function actorOf(user: Pick<CurrentUser, 'id' | 'role' | 'departments'>): Actor {
  return {
    id: user.id,
    role: user.role,
    departmentIds: user.departments.map((department) => department.id),
  };
}

/**
 * Hechos mínimos de una incidencia que deciden los permisos. F03 los construye a partir de la
 * incidencia; si necesita otro hecho, se añade aquí y a la tabla de tests.
 */
export interface IncidentAccessFacts {
  /** Departamento propietario. */
  ownerDepartmentId: string;
  createdById: string;
  assignedToId: string | null;
  status: Status;
}

/**
 * Acciones sobre una incidencia (`permisos.md` → Incidencias). Las transiciones se agrupan por tipo:
 * qué transiciones existen y si piden comentario lo decide la máquina de estados de F04 (CA-02.2).
 */
export const INCIDENT_ACTIONS = [
  'view',
  'update',
  'assign',
  'comment',
  'attach',
  'downloadAttachment',
  'operationalTransition',
  'managementTransition',
] as const;
export type IncidentAction = (typeof INCIDENT_ACTIONS)[number];

/**
 * Relación del actor con una incidencia, de la que salen sus permisos:
 * - `admin`: todo.
 * - `director`: solo ver (y descargar adjuntos).
 * - `departmentManager`: Responsable de una de sus dptos.
 * - `participant`: Usuario o Responsable fuera de sus dptos. (nota ²) que ve la incidencia por ser de
 *   sus dptos., por haberla creado o por tenerla asignada.
 * - `none`: no la ve.
 */
type IncidentRelation = 'admin' | 'director' | 'departmentManager' | 'participant' | 'none';

function relationTo(actor: Actor, facts: IncidentAccessFacts): IncidentRelation {
  switch (actor.role) {
    case 'ADMIN':
      return 'admin';
    case 'DIRECTOR':
      return 'director';
    case 'MANAGER':
    case 'USER': {
      const inDepartments = actor.departmentIds.includes(facts.ownerDepartmentId);
      if (actor.role === 'MANAGER' && inDepartments) return 'departmentManager';
      const involved = isCreator(actor, facts) || isAssignee(actor, facts);
      return inDepartments || involved ? 'participant' : 'none';
    }
  }
}

const isCreator = (actor: Actor, facts: IncidentAccessFacts): boolean =>
  facts.createdById === actor.id;

const isAssignee = (actor: Actor, facts: IncidentAccessFacts): boolean =>
  facts.assignedToId === actor.id;

/** Permisos de quien tiene los de Usuario sobre la incidencia (`participant`). */
function participantCan(actor: Actor, facts: IncidentAccessFacts, action: IncidentAction): boolean {
  switch (action) {
    case 'view':
    case 'downloadAttachment':
    case 'comment':
    case 'attach':
      return true;
    case 'update':
      // Las que ha creado, solo mientras estén ABIERTAS.
      return isCreator(actor, facts) && facts.status === 'OPEN';
    case 'operationalTransition':
      return isCreator(actor, facts) || isAssignee(actor, facts);
    case 'assign':
    case 'managementTransition':
      return false;
  }
}

/**
 * ¿Puede el actor hacer `action` sobre la incidencia? Tabla **Incidencias** y columna "Quién" de
 * **Transiciones de estado** de `permisos.md`, con la nota ² (CA-02.1, CA-02.2).
 */
export function canOnIncident(
  actor: Actor,
  facts: IncidentAccessFacts,
  action: IncidentAction,
): boolean {
  switch (relationTo(actor, facts)) {
    case 'admin':
    case 'departmentManager':
      return true;
    case 'director':
      return action === 'view' || action === 'downloadAttachment';
    case 'participant':
      return participantCan(actor, facts, action);
    case 'none':
      return false;
  }
}

/** Acciones que el actor puede hacer sobre la incidencia, en el orden de `INCIDENT_ACTIONS`. */
export function incidentActionsFor(actor: Actor, facts: IncidentAccessFacts): IncidentAction[] {
  return INCIDENT_ACTIONS.filter((action) => canOnIncident(actor, facts, action));
}

/**
 * Qué incidencias ve el actor en el listado (CA-03.7): `all` (Admin y Dirección) o las de **sus
 * departamentos**, las que **ha creado** y las que **tiene asignadas** (`permisos.md` →
 * Definiciones › Incidencia visible). Lo decide la política; el repositorio solo lo traduce a SQL.
 * Debe coincidir con `canOnIncident(…, 'view')` (lo comprueba su test).
 */
export type IncidentVisibilityScope =
  { kind: 'all' } | { kind: 'restricted'; userId: string; departmentIds: readonly string[] };

export function incidentVisibilityScope(actor: Actor): IncidentVisibilityScope {
  switch (actor.role) {
    case 'ADMIN':
    case 'DIRECTOR':
      return { kind: 'all' };
    case 'MANAGER':
    case 'USER':
      return { kind: 'restricted', userId: actor.id, departmentIds: [...actor.departmentIds] };
  }
}

/** Acciones globales de cada rol (`permisos.md` → Incidencias › Crear y Administración y consulta). */
const GLOBAL_ACTIONS_BY_ROLE: Record<Role, readonly GlobalAction[]> = {
  ADMIN: ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard'],
  DIRECTOR: ['viewDashboard'],
  MANAGER: ['createIncident'],
  USER: ['createIncident'],
};

/**
 * Acciones que no dependen de un recurso (CA-02.4), en el orden de `GlobalAction`. Solo depende del
 * rol, así que sirve también para el usuario recién leído de la BD (login, sesión).
 */
export function globalActionsFor(actor: Pick<Actor, 'role'>): GlobalAction[] {
  const allowed = GLOBAL_ACTIONS_BY_ROLE[actor.role];
  return GlobalAction.options.filter((action) => allowed.includes(action));
}

/** Usuario sobre el que actúa el Admin: lo necesario para las reglas de negocio. */
export interface UserTarget {
  id: string;
  email: string;
  active: boolean;
}

/**
 * Acciones del actor sobre un usuario (`permisos.md` → Gestionar usuarios y aclaración ³), en el
 * orden de `UserAction`:
 * - Solo el Admin gestiona usuarios: para el resto, ninguna.
 * - De un usuario demo solo se cambia el nombre (CA-02.11).
 * - Nadie se desactiva ni se quita el rol a sí mismo (CA-02.10).
 * - `deactivate` si está activo y `activate` si no.
 */
export function userActionsFor(actor: Actor, target: UserTarget): UserAction[] {
  if (!globalActionsFor(actor).includes('manageUsers')) return [];
  if (isDemoUserEmail(target.email)) return ['rename'];

  const isSelf = target.id === actor.id;
  const allowed: Record<UserAction, boolean> = {
    rename: true,
    changeEmail: true,
    changeRole: !isSelf,
    changeDepartments: true,
    deactivate: target.active && !isSelf,
    activate: !target.active,
    resetPassword: true,
  };
  return UserAction.options.filter((action) => allowed[action]);
}
