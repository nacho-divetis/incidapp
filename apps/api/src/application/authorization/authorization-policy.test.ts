// Tabla de la `AuthorizationPolicy` contra `docs/permisos.md` (CA-02.1, CA-02.2, CA-02.4, CA-02.10,
// CA-02.11). Cada fila de las tablas de este archivo cita la fila de `permisos.md` que comprueba.
import { DEMO_USERS, GlobalAction, Status, UserAction, type Role } from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import {
  actorOf,
  canOnIncident,
  globalActionsFor,
  INCIDENT_ACTIONS,
  incidentActionsFor,
  incidentVisibilityScope,
  userActionsFor,
  type Actor,
  type IncidentAccessFacts,
  type IncidentAction,
  type IncidentVisibilityScope,
} from './authorization-policy';

const DEPT_ADM = '00000000-0000-4000-8000-0000000000d1';
const DEPT_DIR = '00000000-0000-4000-8000-0000000000d2';
const DEPT_LOG = '00000000-0000-4000-8000-0000000000d3';
/** Departamento ajeno a todos los actores de la tabla. */
const DEPT_FOREIGN = '00000000-0000-4000-8000-0000000000d9';
const SOMEONE_ELSE = '00000000-0000-4000-8000-0000000000f1';
const ANOTHER_ONE = '00000000-0000-4000-8000-0000000000f2';

const ACTORS: Record<Role, Actor> = {
  ADMIN: { id: '00000000-0000-4000-8000-000000000001', role: 'ADMIN', departmentIds: [DEPT_ADM] },
  DIRECTOR: {
    id: '00000000-0000-4000-8000-000000000002',
    role: 'DIRECTOR',
    departmentIds: [DEPT_DIR],
  },
  MANAGER: {
    id: '00000000-0000-4000-8000-000000000003',
    role: 'MANAGER',
    departmentIds: [DEPT_LOG],
  },
  USER: { id: '00000000-0000-4000-8000-000000000004', role: 'USER', departmentIds: [DEPT_LOG] },
};

/**
 * Relación del actor con la incidencia (`permisos.md` → **Definiciones**). "Creada" y "asignada" son
 * siempre de un departamento ajeno al actor, así que en el Responsable prueban la nota ².
 */
type Relation = 'sus dptos.' | 'creada' | 'asignada' | 'ninguna';
const RELATIONS: readonly Relation[] = ['sus dptos.', 'creada', 'asignada', 'ninguna'];
const ALL: readonly Relation[] = RELATIONS;
const NONE: readonly Relation[] = [];

function factsFor(actor: Actor, relation: Relation, status: Status = 'OPEN'): IncidentAccessFacts {
  switch (relation) {
    case 'sus dptos.':
      return {
        ownerDepartmentId: actor.departmentIds[0]!,
        createdById: SOMEONE_ELSE,
        assignedToId: null,
        status,
      };
    case 'creada':
      return {
        ownerDepartmentId: DEPT_FOREIGN,
        createdById: actor.id,
        assignedToId: null,
        status,
      };
    case 'asignada':
      return {
        ownerDepartmentId: DEPT_FOREIGN,
        createdById: SOMEONE_ELSE,
        assignedToId: actor.id,
        status,
      };
    case 'ninguna':
      return {
        ownerDepartmentId: DEPT_FOREIGN,
        createdById: SOMEONE_ELSE,
        assignedToId: ANOTHER_ONE,
        status,
      };
  }
}

interface MatrixRow {
  /** Fila de `docs/permisos.md` que se comprueba. */
  fila: string;
  action: IncidentAction;
  /** Relaciones con las que cada rol puede hacer la acción (el resto, no). */
  allowed: Record<Role, readonly Relation[]>;
}

/**
 * `permisos.md` → **Incidencias** (y columna "Quién" de **Transiciones de estado**), fila a fila.
 * Estado `OPEN`: la regla "solo mientras estén ABIERTAS" se prueba aparte con cada estado.
 */
const INCIDENT_MATRIX: readonly MatrixRow[] = [
  {
    fila: 'Incidencias › Ver (listado y detalle): Todas · Todas · Visibles · Visibles',
    action: 'view',
    allowed: {
      ADMIN: ALL,
      DIRECTOR: ALL,
      MANAGER: ['sus dptos.', 'creada', 'asignada'],
      USER: ['sus dptos.', 'creada', 'asignada'],
    },
  },
  {
    fila: 'Incidencias › Editar campos: ✅ · ❌ · Las de sus dptos. · Las que ha creado (ABIERTAS) + nota ²',
    action: 'update',
    allowed: { ADMIN: ALL, DIRECTOR: NONE, MANAGER: ['sus dptos.', 'creada'], USER: ['creada'] },
  },
  {
    fila: 'Incidencias › Asignar: ✅ · ❌ · Las de sus dptos. · ❌ (+ aclaración 2)',
    action: 'assign',
    allowed: { ADMIN: ALL, DIRECTOR: NONE, MANAGER: ['sus dptos.'], USER: NONE },
  },
  {
    fila: 'Incidencias › Transiciones operativas: ✅ · ❌ · Las de sus dptos. · Creadas o asignadas + nota ²',
    action: 'operationalTransition',
    allowed: {
      ADMIN: ALL,
      DIRECTOR: NONE,
      MANAGER: ['sus dptos.', 'creada', 'asignada'],
      USER: ['creada', 'asignada'],
    },
  },
  {
    fila: 'Incidencias › Rechazar · Cerrar · Reabrir · Devolver (gestión): ✅ · ❌ · Las de sus dptos. · ❌',
    action: 'managementTransition',
    allowed: { ADMIN: ALL, DIRECTOR: NONE, MANAGER: ['sus dptos.'], USER: NONE },
  },
  {
    fila: 'Incidencias › Comentar: ✅ · ❌ · Visibles · Visibles',
    action: 'comment',
    allowed: {
      ADMIN: ALL,
      DIRECTOR: NONE,
      MANAGER: ['sus dptos.', 'creada', 'asignada'],
      USER: ['sus dptos.', 'creada', 'asignada'],
    },
  },
  {
    fila: 'Incidencias › Adjuntar: ✅ · ❌ · Visibles · Visibles',
    action: 'attach',
    allowed: {
      ADMIN: ALL,
      DIRECTOR: NONE,
      MANAGER: ['sus dptos.', 'creada', 'asignada'],
      USER: ['sus dptos.', 'creada', 'asignada'],
    },
  },
  {
    fila: 'Incidencias › Descargar un adjunto: si puede ver la incidencia (los cuatro roles)',
    action: 'downloadAttachment',
    allowed: {
      ADMIN: ALL,
      DIRECTOR: ALL,
      MANAGER: ['sus dptos.', 'creada', 'asignada'],
      USER: ['sus dptos.', 'creada', 'asignada'],
    },
  },
];

const ROLES = Object.keys(ACTORS) as Role[];

const MATRIX_CASES = INCIDENT_MATRIX.flatMap(({ fila, action, allowed }) =>
  ROLES.flatMap((role) =>
    RELATIONS.map((relation) => ({
      fila,
      action,
      role,
      relation,
      expected: allowed[role].includes(relation),
    })),
  ),
);

describe('CA-02.1 · CA-02.2: canOnIncident aplica la matriz de permisos.md', () => {
  it('la tabla cubre todas las acciones sobre incidencias', () => {
    expect(INCIDENT_MATRIX.map((row) => row.action).sort()).toEqual([...INCIDENT_ACTIONS].sort());
  });

  it.each(MATRIX_CASES)(
    '$fila — $role, relación "$relation" → $expected',
    ({ action, role, relation, expected }) => {
      const actor = ACTORS[role];
      expect(canOnIncident(actor, factsFor(actor, relation), action)).toBe(expected);
    },
  );
});

describe('CA-02.1: el Usuario solo edita lo que ha creado mientras esté ABIERTA', () => {
  // `permisos.md` → Incidencias › Editar campos (columna Usuario) y nota ² (Responsable fuera de sus
  // dptos. = Usuario). Admin y Responsable de sus dptos. editan en cualquier estado.
  const STATUS_CASES = Status.options.flatMap((status) => [
    { who: 'Usuario creador', role: 'USER' as const, relation: 'creada' as const, status },
    {
      who: 'Responsable creador fuera de sus dptos. (nota ²)',
      role: 'MANAGER' as const,
      relation: 'creada' as const,
      status,
    },
    {
      who: 'Responsable de sus dptos.',
      role: 'MANAGER' as const,
      relation: 'sus dptos.' as const,
      status,
    },
    { who: 'Admin', role: 'ADMIN' as const, relation: 'ninguna' as const, status },
  ]);

  it.each(STATUS_CASES)('$who en $status', ({ role, relation, status }) => {
    const actor = ACTORS[role];
    const restrictedToOpen = role === 'USER' || relation === 'creada';
    const expected = restrictedToOpen ? status === 'OPEN' : true;

    expect(canOnIncident(actor, factsFor(actor, relation, status), 'update')).toBe(expected);
  });

  it('el Usuario asignado (no creador) no edita ni en OPEN', () => {
    const actor = ACTORS.USER;
    expect(canOnIncident(actor, factsFor(actor, 'asignada', 'OPEN'), 'update')).toBe(false);
  });
});

describe('CA-02.1: Responsable dentro y fuera de sus departamentos (nota ²)', () => {
  const manager = ACTORS.MANAGER;

  it('fuera de sus dptos., sobre lo que tiene asignado, tiene los permisos de Usuario', () => {
    expect(incidentActionsFor(manager, factsFor(manager, 'asignada'))).toEqual(
      incidentActionsFor(ACTORS.USER, factsFor(ACTORS.USER, 'asignada')),
    );
  });

  it('fuera de sus dptos., sobre lo que ha creado, tiene los permisos de Usuario', () => {
    expect(incidentActionsFor(manager, factsFor(manager, 'creada'))).toEqual(
      incidentActionsFor(ACTORS.USER, factsFor(ACTORS.USER, 'creada')),
    );
  });

  it('en sus dptos., aunque la haya creado, conserva los permisos de Responsable', () => {
    const facts: IncidentAccessFacts = {
      ownerDepartmentId: DEPT_LOG,
      createdById: manager.id,
      assignedToId: null,
      status: 'RESOLVED',
    };
    expect(canOnIncident(manager, facts, 'managementTransition')).toBe(true);
    expect(canOnIncident(manager, facts, 'assign')).toBe(true);
    expect(canOnIncident(manager, facts, 'update')).toBe(true);
  });

  it('con varios departamentos, cuenta cualquiera de ellos', () => {
    const multi: Actor = { ...manager, departmentIds: [DEPT_ADM, DEPT_LOG] };
    const facts = factsFor(multi, 'ninguna');
    expect(canOnIncident(multi, { ...facts, ownerDepartmentId: DEPT_LOG }, 'assign')).toBe(true);
  });
});

describe('incidentActionsFor', () => {
  it('devuelve las acciones permitidas en el orden de INCIDENT_ACTIONS', () => {
    const user = ACTORS.USER;
    expect(incidentActionsFor(user, factsFor(user, 'creada'))).toEqual([
      'view',
      'update',
      'comment',
      'attach',
      'downloadAttachment',
      'operationalTransition',
    ]);
  });

  it('devuelve una lista vacía si la incidencia no es visible', () => {
    const user = ACTORS.USER;
    expect(incidentActionsFor(user, factsFor(user, 'ninguna'))).toEqual([]);
  });

  it('coincide con canOnIncident para cada acción', () => {
    for (const { action, role, relation } of MATRIX_CASES) {
      const actor = ACTORS[role];
      const facts = factsFor(actor, relation);
      expect(incidentActionsFor(actor, facts).includes(action)).toBe(
        canOnIncident(actor, facts, action),
      );
    }
  });
});

describe('CA-02.2 · CA-02.4: globalActionsFor', () => {
  // `permisos.md` → Incidencias › Crear; Administración y consulta › Cuadro de mando, Gestionar
  // usuarios y Consultar la auditoría.
  it.each<{ role: Role; fila: string; expected: GlobalAction[] }>([
    {
      role: 'ADMIN',
      fila: 'Crear ✅ · Cuadro de mando ✅ · Gestionar usuarios ✅ · Auditoría ✅',
      expected: ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard'],
    },
    {
      role: 'DIRECTOR',
      fila: 'Crear ❌ · Cuadro de mando ✅ · Gestionar usuarios ❌ · Auditoría ❌',
      expected: ['viewDashboard'],
    },
    {
      role: 'MANAGER',
      fila: 'Crear ✅ · Cuadro de mando ❌ · Gestionar usuarios ❌ · Auditoría ❌',
      expected: ['createIncident'],
    },
    {
      role: 'USER',
      fila: 'Crear ✅ · Cuadro de mando ❌ · Gestionar usuarios ❌ · Auditoría ❌',
      expected: ['createIncident'],
    },
  ])('$role: $fila', ({ role, expected }) => {
    expect(globalActionsFor(ACTORS[role])).toEqual(expected);
  });

  it('solo devuelve acciones del contrato GlobalAction', () => {
    for (const role of ROLES) {
      for (const action of globalActionsFor(ACTORS[role])) {
        expect(GlobalAction.options).toContain(action);
      }
    }
  });
});

describe('CA-02.10 · CA-02.11: userActionsFor', () => {
  const admin = ACTORS.ADMIN;
  const OTHER_ID = '00000000-0000-4000-8000-0000000000a1';
  const DEMO_EMAIL = DEMO_USERS[3]!.email;

  it.each<{
    caso: string;
    target: { id: string; email: string; active: boolean };
    expected: UserAction[];
  }>([
    {
      caso: 'otro usuario activo: todo salvo reactivar',
      target: { id: OTHER_ID, email: 'nuevo@incidapp.test', active: true },
      expected: [
        'rename',
        'changeEmail',
        'changeRole',
        'changeDepartments',
        'deactivate',
        'resetPassword',
      ],
    },
    {
      caso: 'otro usuario desactivado: todo salvo desactivar',
      target: { id: OTHER_ID, email: 'nuevo@incidapp.test', active: false },
      expected: [
        'rename',
        'changeEmail',
        'changeRole',
        'changeDepartments',
        'activate',
        'resetPassword',
      ],
    },
    {
      caso: 'uno mismo (aclaración ³): sin desactivar ni cambiar el rol',
      target: { id: admin.id, email: 'otro-admin@incidapp.test', active: true },
      expected: ['rename', 'changeEmail', 'changeDepartments', 'resetPassword'],
    },
    {
      caso: 'usuario demo (CA-02.11): solo el nombre',
      target: { id: OTHER_ID, email: DEMO_EMAIL, active: true },
      expected: ['rename'],
    },
    {
      caso: 'usuario demo con el email en otra forma: también protegido',
      target: { id: OTHER_ID, email: ` ${DEMO_EMAIL.toUpperCase()} `, active: true },
      expected: ['rename'],
    },
    {
      caso: 'usuario demo desactivado: tampoco se reactiva',
      target: { id: OTHER_ID, email: DEMO_EMAIL, active: false },
      expected: ['rename'],
    },
    {
      caso: 'el Admin demo sobre sí mismo: solo el nombre',
      target: { id: admin.id, email: DEMO_USERS[0]!.email, active: true },
      expected: ['rename'],
    },
  ])('Admin sobre $caso', ({ target, expected }) => {
    expect(userActionsFor(admin, target)).toEqual(expected);
  });

  it.each<Role>(['DIRECTOR', 'MANAGER', 'USER'])(
    '%s no tiene ninguna acción sobre usuarios (Gestionar usuarios: solo Admin)',
    (role) => {
      const target = { id: OTHER_ID, email: 'nuevo@incidapp.test', active: true };
      expect(userActionsFor(ACTORS[role], target)).toEqual([]);
    },
  );

  it('solo devuelve acciones del contrato UserAction', () => {
    const target = { id: OTHER_ID, email: 'nuevo@incidapp.test', active: true };
    for (const action of userActionsFor(admin, target)) {
      expect(UserAction.options).toContain(action);
    }
  });
});

describe('actorOf', () => {
  it('obtiene el actor (id, rol e ids de sus departamentos) del usuario actual', () => {
    expect(
      actorOf({
        id: ACTORS.MANAGER.id,
        role: 'MANAGER',
        departments: [
          { id: DEPT_LOG, code: 'LOG', name: 'Logística y Almacén' },
          { id: DEPT_ADM, code: 'ADM', name: 'Administración' },
        ],
      }),
    ).toEqual({ id: ACTORS.MANAGER.id, role: 'MANAGER', departmentIds: [DEPT_LOG, DEPT_ADM] });
  });
});

/**
 * Lo que hace el repositorio con el `scope` (traducirlo a SQL), escrito en TypeScript: así se
 * comprueba que la política del listado y la del detalle dicen lo mismo.
 */
function inScope(scope: IncidentVisibilityScope, facts: IncidentAccessFacts): boolean {
  if (scope.kind === 'all') return true;
  return (
    scope.departmentIds.includes(facts.ownerDepartmentId) ||
    facts.createdById === scope.userId ||
    facts.assignedToId === scope.userId
  );
}

describe('CA-03.7: incidentVisibilityScope (visibilidad del listado)', () => {
  it.each<{ role: Role; kind: IncidentVisibilityScope['kind'] }>([
    { role: 'ADMIN', kind: 'all' },
    { role: 'DIRECTOR', kind: 'all' },
    { role: 'MANAGER', kind: 'restricted' },
    { role: 'USER', kind: 'restricted' },
  ])('$role ve $kind (permisos.md → Incidencias › Ver)', ({ role, kind }) => {
    expect(incidentVisibilityScope(ACTORS[role]).kind).toBe(kind);
  });

  it('restricted lleva el id del actor y los ids de sus departamentos', () => {
    const actor: Actor = { ...ACTORS.MANAGER, departmentIds: [DEPT_LOG, DEPT_ADM] };
    expect(incidentVisibilityScope(actor)).toEqual({
      kind: 'restricted',
      userId: actor.id,
      departmentIds: [DEPT_LOG, DEPT_ADM],
    });
  });

  const CASES = (Object.keys(ACTORS) as Role[]).flatMap((role) =>
    RELATIONS.flatMap((relation) => Status.options.map((status) => ({ role, relation, status }))),
  );

  it.each(CASES)(
    '$role · $relation · $status: está en el scope si y solo si canOnIncident permite ver',
    ({ role, relation, status }) => {
      const actor = ACTORS[role];
      const facts = factsFor(actor, relation, status);
      expect(inScope(incidentVisibilityScope(actor), facts)).toBe(
        canOnIncident(actor, facts, 'view'),
      );
    },
  );

  it('un actor sin departamentos solo ve lo que ha creado o tiene asignado', () => {
    const actor: Actor = { ...ACTORS.USER, departmentIds: [] };
    for (const relation of ['creada', 'asignada', 'ninguna'] as const) {
      const facts = factsFor(actor, relation);
      expect(inScope(incidentVisibilityScope(actor), facts)).toBe(
        canOnIncident(actor, facts, 'view'),
      );
    }
  });
});
