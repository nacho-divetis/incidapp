import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AllowedTransition,
  AssignIncidentInput,
  CreateIncidentInput,
  DueDate,
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  INCIDENT_TITLE_MAX_LENGTH,
  INCIDENTS_PAGE_SIZE,
  Incident,
  IncidentAllowedAction,
  IncidentDescription,
  IncidentEventType,
  IncidentListItem,
  IncidentListQuery,
  IncidentListResponse,
  IncidentTitle,
  IncidentTypeSummary,
  Priority,
  UpdateIncidentInput,
  UserSummary,
} from './index';

/** Mensajes de error por campo, en el formato en que los recibe la interfaz (`''` = el objeto). */
function fieldErrors(schema: z.ZodType, body: unknown): Record<string, string[]> {
  const result = schema.safeParse(body);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

const TYPE_ID = '0b9d8c7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a';
const DEPARTMENT_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const USER_ID = '6f1c2a5e-8d3b-4c7a-9e2f-1a2b3c4d5e6f';
const OTHER_USER_ID = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const INCIDENT_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';

const validCreate = {
  title: 'Palé dañado en la entrega',
  description: 'El transportista entregó el palé con el film roto y dos cajas aplastadas.',
  typeId: TYPE_ID,
  priority: 'HIGH',
  dueDate: '2026-12-15',
};

/** Campos que decide el servidor (`permisos.md`, "Lo que nunca decide el cliente"). */
const serverFields = {
  id: INCIDENT_ID,
  code: 'INC-2026-0001',
  status: 'CLOSED',
  departmentId: DEPARTMENT_ID,
  createdBy: USER_ID,
  assignedTo: OTHER_USER_ID,
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
  resolvedAt: '2026-11-25T10:00:00.000Z',
  closedAt: '2026-11-25T10:00:00.000Z',
};

describe('enums de incidencias', () => {
  it('Priority define las cuatro prioridades del glosario', () => {
    expect(Priority.options).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });

  it('IncidentEventType define los cuatro tipos de evento, también el de F04', () => {
    expect(IncidentEventType.options).toEqual(['CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED']);
  });

  it('CA-03.6: IncidentAllowedAction solo expone editar y asignar', () => {
    expect(IncidentAllowedAction.options).toEqual(['update', 'assign']);
  });

  it('AllowedTransition lleva el estado destino y si exige comentario', () => {
    expect(AllowedTransition.parse({ to: 'RESOLVED', requiresComment: false })).toEqual({
      to: 'RESOLVED',
      requiresComment: false,
    });
    expect(AllowedTransition.safeParse({ to: 'DONE', requiresComment: false }).success).toBe(false);
  });
});

describe('IncidentTitle', () => {
  it('CA-03.3: quita los espacios de los extremos', () => {
    expect(IncidentTitle.parse('  Palé dañado  ')).toBe('Palé dañado');
  });

  it('CA-03.3: acepta 1 y 150 caracteres y rechaza 151 (ya recortado)', () => {
    expect(INCIDENT_TITLE_MAX_LENGTH).toBe(150);
    expect(IncidentTitle.safeParse('x').success).toBe(true);
    expect(IncidentTitle.safeParse(`  ${'x'.repeat(150)}  `).success).toBe(true);
    expect(IncidentTitle.safeParse('x'.repeat(151)).error?.issues.map((i) => i.message)).toEqual([
      'El título no puede tener más de 150 caracteres.',
    ]);
  });

  it.each([
    ['vacío', ''],
    ['solo con espacios', '   '],
  ])('CA-03.3: rechaza un título %s', (_case, title) => {
    expect(IncidentTitle.safeParse(title).error?.issues.map((i) => i.message)).toEqual([
      'El título es obligatorio.',
    ]);
  });
});

describe('IncidentDescription', () => {
  it('CA-03.3: acepta 5000 caracteres y rechaza 5001', () => {
    expect(INCIDENT_DESCRIPTION_MAX_LENGTH).toBe(5000);
    expect(IncidentDescription.safeParse('x'.repeat(5000)).success).toBe(true);
    expect(
      IncidentDescription.safeParse('x'.repeat(5001)).error?.issues.map((i) => i.message),
    ).toEqual(['La descripción no puede tener más de 5000 caracteres.']);
  });

  it('CA-03.3: rechaza una descripción solo con espacios', () => {
    expect(IncidentDescription.safeParse('  \n ').error?.issues.map((i) => i.message)).toEqual([
      'La descripción es obligatoria.',
    ]);
  });

  it('CA-03.3: conserva los saltos de línea interiores', () => {
    expect(IncidentDescription.parse(' Línea 1\nLínea 2 ')).toBe('Línea 1\nLínea 2');
  });
});

describe('DueDate', () => {
  it.each(['2026-12-15', '2028-02-29'])('CA-03.3: acepta la fecha %s', (date) => {
    expect(DueDate.parse(date)).toBe(date);
  });

  it.each([
    ['en formato español', '15/12/2026'],
    ['con hora', '2026-12-15T10:00:00Z'],
    ['con un mes inexistente', '2026-13-01'],
    ['con un día inexistente', '2026-02-30'],
    ['vacía', ''],
  ])('CA-03.3: rechaza una fecha %s', (_case, date) => {
    expect(DueDate.safeParse(date).error?.issues.map((i) => i.message)).toEqual([
      'La fecha objetivo no es válida (AAAA-MM-DD).',
    ]);
  });
});

describe('CreateIncidentInput', () => {
  it('CA-03.2: acepta un alta válida y recorta el título y la descripción', () => {
    expect(
      CreateIncidentInput.parse({
        ...validCreate,
        title: `  ${validCreate.title} `,
        description: ` ${validCreate.description}  `,
      }),
    ).toEqual(validCreate);
  });

  it('CA-03.2: la fecha objetivo es opcional', () => {
    const { dueDate: _dueDate, ...withoutDueDate } = validCreate;

    expect(CreateIncidentInput.parse(withoutDueDate)).toEqual(withoutDueDate);
  });

  it('CA-03.2: descarta los campos que decide el servidor', () => {
    expect(CreateIncidentInput.parse({ ...validCreate, ...serverFields })).toEqual(validCreate);
  });

  it.each([
    ['sin título', { title: undefined }, { title: ['El título es obligatorio.'] }],
    ['con el título vacío', { title: ' ' }, { title: ['El título es obligatorio.'] }],
    [
      'con un título de 151 caracteres',
      { title: 'x'.repeat(151) },
      { title: ['El título no puede tener más de 150 caracteres.'] },
    ],
    [
      'sin descripción',
      { description: undefined },
      { description: ['La descripción es obligatoria.'] },
    ],
    [
      'con la descripción vacía',
      { description: '' },
      { description: ['La descripción es obligatoria.'] },
    ],
    [
      'con una descripción de 5001 caracteres',
      { description: 'x'.repeat(5001) },
      { description: ['La descripción no puede tener más de 5000 caracteres.'] },
    ],
    ['sin tipo', { typeId: undefined }, { typeId: ['Selecciona el tipo de incidencia.'] }],
    ['con el tipo vacío', { typeId: '' }, { typeId: ['Selecciona el tipo de incidencia.'] }],
    [
      'con un tipo que no es UUID',
      { typeId: 'LOG' },
      { typeId: ['El tipo de incidencia no es válido.'] },
    ],
    ['sin prioridad', { priority: undefined }, { priority: ['La prioridad es obligatoria.'] }],
    [
      'con una prioridad desconocida',
      { priority: 'CRITICAL' },
      { priority: ['La prioridad no es válida.'] },
    ],
    [
      'con una fecha que no es AAAA-MM-DD',
      { dueDate: '15/12/2026' },
      { dueDate: ['La fecha objetivo no es válida (AAAA-MM-DD).'] },
    ],
    [
      'con la fecha a null',
      { dueDate: null },
      { dueDate: ['La fecha objetivo no es válida (AAAA-MM-DD).'] },
    ],
  ])('CA-03.3: rechaza un alta %s con mensajes en español', (_case, changes, expected) => {
    expect(fieldErrors(CreateIncidentInput, { ...validCreate, ...changes })).toEqual(expected);
  });

  it('CA-03.3: un alta vacía da un error en español por cada campo obligatorio', () => {
    expect(fieldErrors(CreateIncidentInput, {})).toEqual({
      title: ['El título es obligatorio.'],
      description: ['La descripción es obligatoria.'],
      typeId: ['Selecciona el tipo de incidencia.'],
      priority: ['La prioridad es obligatoria.'],
    });
  });
});

describe('UpdateIncidentInput', () => {
  it.each([
    ['el título', { title: ' Nuevo título ' }, { title: 'Nuevo título' }],
    ['la descripción', { description: 'Otra descripción' }, { description: 'Otra descripción' }],
    ['la prioridad', { priority: 'URGENT' }, { priority: 'URGENT' }],
    ['la fecha objetivo', { dueDate: '2027-01-10' }, { dueDate: '2027-01-10' }],
  ])('CA-03.9: acepta cambiar solo %s', (_case, body, expected) => {
    expect(UpdateIncidentInput.parse(body)).toEqual(expected);
  });

  it('CA-03.9: `dueDate: null` quita la fecha objetivo (y cuenta como cambio)', () => {
    expect(UpdateIncidentInput.parse({ dueDate: null })).toEqual({ dueDate: null });
  });

  it('CA-03.9: acepta todos los campos a la vez', () => {
    const { typeId: _typeId, ...all } = validCreate;

    expect(UpdateIncidentInput.parse(all)).toEqual(all);
  });

  it('CA-03.9: aplica las validaciones del alta', () => {
    expect(
      fieldErrors(UpdateIncidentInput, {
        title: '',
        description: 'x'.repeat(5001),
        priority: 'CRITICAL',
        dueDate: '2026-02-30',
      }),
    ).toEqual({
      title: ['El título es obligatorio.'],
      description: ['La descripción no puede tener más de 5000 caracteres.'],
      priority: ['La prioridad no es válida.'],
      dueDate: ['La fecha objetivo no es válida (AAAA-MM-DD).'],
    });
  });

  it('CA-03.9: rechaza una edición sin ningún campo', () => {
    expect(fieldErrors(UpdateIncidentInput, {})).toEqual({
      '': ['Indica al menos un campo que cambiar.'],
    });
  });

  it('CA-03.9: descarta el tipo, el estado, el asignado y los demás campos del servidor', () => {
    expect(
      UpdateIncidentInput.parse({ title: 'Nuevo título', typeId: TYPE_ID, ...serverFields }),
    ).toEqual({ title: 'Nuevo título' });
  });

  it('CA-03.9: una edición con solo campos descartados equivale a una edición vacía', () => {
    expect(fieldErrors(UpdateIncidentInput, { typeId: TYPE_ID, ...serverFields })).toEqual({
      '': ['Indica al menos un campo que cambiar.'],
    });
  });
});

describe('AssignIncidentInput', () => {
  it('CA-03.10: acepta el usuario al que se asigna y descarta lo demás', () => {
    expect(AssignIncidentInput.parse({ assigneeId: USER_ID, status: 'IN_PROGRESS' })).toEqual({
      assigneeId: USER_ID,
    });
  });

  it.each([
    ['sin usuario', {}, { assigneeId: ['Selecciona a quién asignarla.'] }],
    ['con el usuario vacío', { assigneeId: '' }, { assigneeId: ['Selecciona a quién asignarla.'] }],
    [
      'con un usuario que no es UUID',
      { assigneeId: 'lucia' },
      { assigneeId: ['El usuario no es válido.'] },
    ],
    [
      'con un usuario que no es texto',
      { assigneeId: 42 },
      { assigneeId: ['El usuario no es válido.'] },
    ],
  ])('CA-03.10: rechaza una asignación %s', (_case, body, expected) => {
    expect(fieldErrors(AssignIncidentInput, body)).toEqual(expected);
  });
});

describe('IncidentListQuery', () => {
  it('CA-03.7: sin parámetros pide la página 1 sin filtros', () => {
    expect(INCIDENTS_PAGE_SIZE).toBe(20);
    expect(IncidentListQuery.parse({})).toEqual({ page: 1 });
  });

  it('CA-03.8: convierte los parámetros de la query string y combina todos los filtros', () => {
    expect(
      IncidentListQuery.parse({
        status: 'OPEN',
        priority: 'URGENT',
        departmentId: DEPARTMENT_ID,
        assignedToMe: 'true',
        q: '  inc-2026 ',
        page: '3',
      }),
    ).toEqual({
      status: 'OPEN',
      priority: 'URGENT',
      departmentId: DEPARTMENT_ID,
      assignedToMe: true,
      q: 'inc-2026',
      page: 3,
    });
  });

  it('CA-03.8: `assignedToMe=false` es un booleano falso, no un texto', () => {
    expect(IncidentListQuery.parse({ assignedToMe: 'false' })).toEqual({
      assignedToMe: false,
      page: 1,
    });
  });

  it('CA-03.8: un texto de búsqueda vacío equivale a no buscar', () => {
    expect(IncidentListQuery.parse({ q: '   ' })).toEqual({ page: 1 });
  });

  it('CA-03.8: acepta 100 caracteres de búsqueda y rechaza 101', () => {
    expect(IncidentListQuery.safeParse({ q: 'x'.repeat(100) }).success).toBe(true);
    expect(fieldErrors(IncidentListQuery, { q: 'x'.repeat(101) })).toEqual({
      q: ['La búsqueda no puede tener más de 100 caracteres.'],
    });
  });

  it('CA-03.8: descarta los parámetros desconocidos', () => {
    expect(IncidentListQuery.parse({ typeId: TYPE_ID, pageSize: '500' })).toEqual({ page: 1 });
  });

  it.each([
    ['un estado inexistente', { status: 'DONE' }, { status: ['El estado no es válido.'] }],
    ['varios estados', { status: ['OPEN', 'CLOSED'] }, { status: ['El estado no es válido.'] }],
    [
      'una prioridad inexistente',
      { priority: 'CRITICAL' },
      { priority: ['La prioridad no es válida.'] },
    ],
    [
      'un departamento que no es UUID',
      { departmentId: 'LOG' },
      { departmentId: ['El departamento no es válido.'] },
    ],
    [
      '`assignedToMe` que no es true ni false',
      { assignedToMe: 'yes' },
      { assignedToMe: ['El filtro "Asignadas a mí" no es válido.'] },
    ],
    ['la página 0', { page: '0' }, { page: ['La página no es válida.'] }],
    ['una página negativa', { page: '-1' }, { page: ['La página no es válida.'] }],
    ['una página decimal', { page: '1.5' }, { page: ['La página no es válida.'] }],
    ['una página que no es un número', { page: 'dos' }, { page: ['La página no es válida.'] }],
    ['una página vacía', { page: '' }, { page: ['La página no es válida.'] }],
  ])('CA-03.8: rechaza %s', (_case, query, expected) => {
    expect(fieldErrors(IncidentListQuery, query)).toEqual(expected);
  });
});

const department = { id: DEPARTMENT_ID, code: 'LOG', name: 'Logística y Almacén' };
const type = { id: TYPE_ID, code: 'TRANSPORT', name: 'Transporte' };
const assignee = { id: OTHER_USER_ID, name: 'Marta Ruiz' };

describe('UserSummary e IncidentTypeSummary', () => {
  it('UserSummary solo lleva id y nombre', () => {
    expect(
      UserSummary.parse({ id: USER_ID, name: 'Lucía Gómez', email: 'lucia@incidapp.test' }),
    ).toEqual({ id: USER_ID, name: 'Lucía Gómez' });
  });

  it('CA-03.1: IncidentTypeSummary lleva su departamento por defecto', () => {
    const summary = { ...type, department };

    expect(IncidentTypeSummary.parse(summary)).toEqual(summary);
    expect(IncidentTypeSummary.safeParse(type).success).toBe(false);
  });
});

describe('IncidentListItem e IncidentListResponse', () => {
  const item = {
    id: INCIDENT_ID,
    code: 'INC-2026-0001',
    title: 'Palé dañado en la entrega',
    type,
    department,
    priority: 'HIGH',
    status: 'OPEN',
    assignee: null,
    dueDate: '2026-12-15',
    createdAt: '2026-11-25T10:00:00.000Z',
  };

  it('CA-03.7: acepta un elemento sin asignado ni fecha objetivo y descarta lo demás', () => {
    const withoutDueDate = { ...item, dueDate: null };

    expect(
      IncidentListItem.parse({ ...withoutDueDate, description: 'No va en el listado' }),
    ).toEqual(withoutDueDate);
  });

  it('CA-03.7: acepta un elemento con asignado', () => {
    expect(IncidentListItem.parse({ ...item, assignee })).toEqual({ ...item, assignee });
  });

  it.each([
    ['un código mal formado', { code: 'INC-26-1' }],
    ['una prioridad desconocida', { priority: 'CRITICAL' }],
    ['una fecha objetivo con hora', { dueDate: '2026-12-15T00:00:00Z' }],
    ['una fecha de alta que no es ISO', { createdAt: '25/11/2026' }],
    ['el tipo sin código', { type: { id: TYPE_ID, name: 'Transporte' } }],
  ])('CA-03.7: rechaza un elemento con %s', (_case, changes) => {
    expect(IncidentListItem.safeParse({ ...item, ...changes }).success).toBe(false);
  });

  it('CA-03.7: la respuesta paginada lleva los elementos, el total, la página y su tamaño', () => {
    const response = { items: [item], total: 41, page: 3, pageSize: INCIDENTS_PAGE_SIZE };

    expect(IncidentListResponse.parse(response)).toEqual(response);
    expect(IncidentListResponse.safeParse({ ...response, page: 0 }).success).toBe(false);
    expect(IncidentListResponse.safeParse({ ...response, total: -1 }).success).toBe(false);
  });
});

describe('Incident', () => {
  const incident = {
    id: INCIDENT_ID,
    code: 'INC-2026-0001',
    title: 'Palé dañado en la entrega',
    description: 'El transportista entregó el palé con el film roto.',
    type,
    department,
    priority: 'HIGH',
    status: 'OPEN',
    createdBy: { id: USER_ID, name: 'Lucía Gómez' },
    assignee: null,
    dueDate: null,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    resolvedAt: null,
    closedAt: null,
    allowedActions: ['update', 'assign'],
    allowedTransitions: [],
  };

  it('CA-03.6: acepta el detalle con sus acciones permitidas y sin transiciones (F03)', () => {
    expect(Incident.parse(incident)).toEqual(incident);
  });

  it('CA-03.6: la forma ya admite las transiciones y las fechas de resolución y cierre de F04', () => {
    const closed = {
      ...incident,
      status: 'CLOSED',
      assignee,
      resolvedAt: '2026-11-26T09:00:00.000Z',
      closedAt: '2026-11-27T09:00:00.000Z',
      allowedActions: [],
      allowedTransitions: [{ to: 'REOPENED', requiresComment: true }],
    };

    expect(Incident.parse(closed)).toEqual(closed);
  });

  it('CA-03.6: descarta datos internos (ids sueltos del departamento o del creador)', () => {
    expect(
      Incident.parse({ ...incident, departmentId: DEPARTMENT_ID, createdById: USER_ID }),
    ).toEqual(incident);
  });

  it.each([
    ['una acción que no se expone (`view`)', { allowedActions: ['view'] }],
    [
      'una transición a un estado desconocido',
      { allowedTransitions: [{ to: 'DONE', requiresComment: false }] },
    ],
    ['sin creador', { createdBy: undefined }],
    ['sin `allowedTransitions`', { allowedTransitions: undefined }],
    ['sin `resolvedAt`', { resolvedAt: undefined }],
  ])('CA-03.6: rechaza un detalle con %s', (_case, changes) => {
    expect(Incident.safeParse({ ...incident, ...changes }).success).toBe(false);
  });
});
