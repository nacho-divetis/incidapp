// Datos ficticios de incidencias (empresa inventada) con la forma del contrato de `shared`. Los usan
// los tests y las stories de los organismos de incidencias y, después, los tests de las páginas.
import type {
  DepartmentSummary,
  Incident,
  IncidentEvent,
  IncidentListItem,
  IncidentTypeSummary,
  UserSummary,
} from '@incidapp/shared';

export const INCIDENT_DEPARTMENTS = {
  LOG: { id: '7a1b2c3d-0001-4a6b-8c7d-9e0f1a2b3c01', code: 'LOG', name: 'Logística y Almacén' },
  ATC: {
    id: '7a1b2c3d-0002-4a6b-8c7d-9e0f1a2b3c02',
    code: 'ATC',
    name: 'Atención al Cliente / Postventa',
  },
  TEC: { id: '7a1b2c3d-0003-4a6b-8c7d-9e0f1a2b3c03', code: 'TEC', name: 'Departamento Técnico' },
} satisfies Record<string, DepartmentSummary>;

/** Catálogo de departamentos para el filtro del listado. */
export const INCIDENT_DEPARTMENT_LIST: DepartmentSummary[] = Object.values(INCIDENT_DEPARTMENTS);

/** Tipos de incidencia con su departamento por defecto (`GET /api/incident-types`). */
export const INCIDENT_TYPES = {
  TRANSPORT: {
    id: '8b2c3d4e-0001-4b7c-8d9e-0f1a2b3c4d01',
    code: 'TRANSPORT',
    name: 'Transporte',
    department: INCIDENT_DEPARTMENTS.LOG,
  },
  CUSTOMER: {
    id: '8b2c3d4e-0002-4b7c-8d9e-0f1a2b3c4d02',
    code: 'CUSTOMER',
    name: 'Cliente / Reclamación',
    department: INCIDENT_DEPARTMENTS.ATC,
  },
  TECHNICAL: {
    id: '8b2c3d4e-0003-4b7c-8d9e-0f1a2b3c4d03',
    code: 'TECHNICAL',
    name: 'Técnica / Instalación',
    department: INCIDENT_DEPARTMENTS.TEC,
  },
} satisfies Record<string, IncidentTypeSummary>;

export const INCIDENT_TYPE_LIST: IncidentTypeSummary[] = Object.values(INCIDENT_TYPES);

export const PEOPLE = {
  LUIS: { id: '9c3d4e5f-0001-4c8d-9e0f-1a2b3c4d5e01', name: 'Luis Navarro' },
  MARTA: { id: '9c3d4e5f-0002-4c8d-9e0f-1a2b3c4d5e02', name: 'Marta Gil' },
  PABLO: { id: '9c3d4e5f-0003-4c8d-9e0f-1a2b3c4d5e03', name: 'Pablo Sanz' },
} satisfies Record<string, UserSummary>;

/** Referencia al tipo tal como viaja dentro de una incidencia (sin el departamento). */
function typeRef({ id, code, name }: IncidentTypeSummary) {
  return { id, code, name };
}

/** Incidencia de Logística creada por Luis y asignada a Marta, con todas las acciones. */
export const INCIDENT: Incident = {
  id: 'ad4e5f6a-0001-4d9e-8f0a-2b3c4d5e6f01',
  code: 'INC-2026-0007',
  title: 'Palé dañado en la recepción del camión de las 8:00',
  description:
    'El palé 3 del pedido 4512 llegó con el film roto y dos cajas aplastadas.\nSe ha apartado en la zona de cuarentena a la espera de revisión.',
  type: typeRef(INCIDENT_TYPES.TRANSPORT),
  department: INCIDENT_DEPARTMENTS.LOG,
  priority: 'HIGH',
  status: 'OPEN',
  createdBy: PEOPLE.LUIS,
  assignee: PEOPLE.MARTA,
  dueDate: '2026-11-30',
  createdAt: '2026-11-24T07:15:00.000Z',
  updatedAt: '2026-11-24T09:40:00.000Z',
  resolvedAt: null,
  closedAt: null,
  allowedActions: ['update', 'assign'],
  allowedTransitions: [],
};

/** La misma incidencia sin asignado, sin fecha objetivo y sin acciones permitidas. */
export const UNASSIGNED_INCIDENT: Incident = {
  ...INCIDENT,
  assignee: null,
  dueDate: null,
  allowedActions: [],
};

/** Página del listado con incidencias de varios departamentos, prioridades y estados. */
export const INCIDENT_LIST_ITEMS: IncidentListItem[] = [
  {
    id: INCIDENT.id,
    code: INCIDENT.code,
    title: INCIDENT.title,
    type: INCIDENT.type,
    department: INCIDENT.department,
    priority: INCIDENT.priority,
    status: INCIDENT.status,
    assignee: INCIDENT.assignee,
    dueDate: INCIDENT.dueDate,
    createdAt: INCIDENT.createdAt,
  },
  {
    id: 'ad4e5f6a-0002-4d9e-8f0a-2b3c4d5e6f02',
    code: 'INC-2026-0006',
    title: 'Cliente reclama un cargo duplicado en la factura de octubre',
    type: typeRef(INCIDENT_TYPES.CUSTOMER),
    department: INCIDENT_DEPARTMENTS.ATC,
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assignee: PEOPLE.PABLO,
    dueDate: '2026-11-26',
    createdAt: '2026-11-23T16:05:00.000Z',
  },
  {
    id: 'ad4e5f6a-0003-4d9e-8f0a-2b3c4d5e6f03',
    code: 'INC-2026-0005',
    title: 'La impresora de etiquetas del muelle 2 no conecta',
    type: typeRef(INCIDENT_TYPES.TECHNICAL),
    department: INCIDENT_DEPARTMENTS.TEC,
    priority: 'LOW',
    status: 'RESOLVED',
    assignee: null,
    dueDate: null,
    createdAt: '2026-11-20T08:30:00.000Z',
  },
];

/** Historial de `INCIDENT` (`GET /api/incidents/:id/events`): alta y asignación a Marta. */
export const INCIDENT_EVENTS: IncidentEvent[] = [
  {
    id: 'be5f6a7b-0001-4e0f-9a1b-3c4d5e6f7a01',
    type: 'CREATED',
    actor: PEOPLE.LUIS,
    createdAt: INCIDENT.createdAt,
    data: {},
  },
  {
    id: 'be5f6a7b-0002-4e0f-9a1b-3c4d5e6f7a02',
    type: 'ASSIGNED',
    actor: PEOPLE.LUIS,
    createdAt: INCIDENT.updatedAt,
    data: { from: null, to: PEOPLE.MARTA },
  },
];
