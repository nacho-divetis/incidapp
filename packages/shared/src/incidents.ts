import { z } from 'zod';
import { DepartmentSummary } from './auth';
import { Status } from './status';

/** Prioridades de una incidencia (`docs/glosario.md`). */
export const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type Priority = z.infer<typeof Priority>;

/**
 * Tipos de evento del historial (`incident_events`). Se definen todos en F03, también el
 * `STATUS_CHANGED` de F04, para que el enum de la BD no cambie entre features.
 */
export const IncidentEventType = z.enum(['CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED']);
export type IncidentEventType = z.infer<typeof IncidentEventType>;

/**
 * Acciones sobre una incidencia que la API expone en `Incident.allowedActions`. Los cambios de
 * estado van aparte, en `allowedTransitions`. No se llama `IncidentAction` para no confundirse con
 * el tipo interno de la `AuthorizationPolicy`, que incluye más acciones (`view`, transiciones…).
 */
export const IncidentAllowedAction = z.enum(['update', 'assign']);
export type IncidentAllowedAction = z.infer<typeof IncidentAllowedAction>;

/** Cambio de estado que el actor puede hacer y si exige un comentario. F03 siempre devuelve `[]`. */
export const AllowedTransition = z.object({
  to: Status,
  requiresComment: z.boolean(),
});
export type AllowedTransition = z.infer<typeof AllowedTransition>;

/** Usuario resumido: creador, asignado y candidatos a asignar. */
export const UserSummary = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});
export type UserSummary = z.infer<typeof UserSummary>;

/** Tipo de incidencia tal como aparece dentro de una incidencia. */
const IncidentTypeRef = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
});

/** Tipo de incidencia con su departamento por defecto: respuesta de `GET /api/incident-types`. */
export const IncidentTypeSummary = IncidentTypeRef.extend({ department: DepartmentSummary });
export type IncidentTypeSummary = z.infer<typeof IncidentTypeSummary>;

/** Longitud máxima del título de una incidencia, ya sin los espacios de los extremos. */
export const INCIDENT_TITLE_MAX_LENGTH = 150;

/** Longitud máxima de la descripción de una incidencia, ya sin los espacios de los extremos. */
export const INCIDENT_DESCRIPTION_MAX_LENGTH = 5000;

/** Longitud máxima del texto de búsqueda del listado. */
export const INCIDENT_SEARCH_MAX_LENGTH = 100;

/** Incidencias por página en el listado (fijo). */
export const INCIDENTS_PAGE_SIZE = 20;

/** Título de una incidencia: sin espacios en los extremos, de 1 a 150 caracteres. */
export const IncidentTitle = z
  .string({
    error: (issue) =>
      issue.input === undefined ? 'El título es obligatorio.' : 'El título no es válido.',
  })
  .trim()
  .min(1, 'El título es obligatorio.')
  .max(
    INCIDENT_TITLE_MAX_LENGTH,
    `El título no puede tener más de ${INCIDENT_TITLE_MAX_LENGTH} caracteres.`,
  );

/** Descripción de una incidencia: sin espacios en los extremos, de 1 a 5000 caracteres. */
export const IncidentDescription = z
  .string({
    error: (issue) =>
      issue.input === undefined ? 'La descripción es obligatoria.' : 'La descripción no es válida.',
  })
  .trim()
  .min(1, 'La descripción es obligatoria.')
  .max(
    INCIDENT_DESCRIPTION_MAX_LENGTH,
    `La descripción no puede tener más de ${INCIDENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
  );

/**
 * Fecha objetivo `AAAA-MM-DD`: fecha sin hora, que viaja tal cual y no se convierte de zona.
 */
export const DueDate = z.iso.date('La fecha objetivo no es válida (AAAA-MM-DD).');

/** Prioridad elegida en un formulario, con mensajes en español. */
const PriorityInput = z.enum(Priority.options, {
  error: (issue) =>
    issue.input === undefined ? 'La prioridad es obligatoria.' : 'La prioridad no es válida.',
});

/** Identificador elegido en un selector: vacío o ausente es "sin elegir". */
function selectedId(missing: string, invalid: string) {
  return z.uuid({
    error: (issue) => (issue.input === undefined || issue.input === '' ? missing : invalid),
  });
}

/**
 * Cuerpo de `POST /api/incidents` (CA-03.2, CA-03.3). Que el tipo exista lo comprueba la API. Los
 * campos que decide el servidor (`code`, `status`, `departmentId`, `createdBy`, `assignedTo`,
 * fechas…) se descartan.
 */
export const CreateIncidentInput = z.object({
  title: IncidentTitle,
  description: IncidentDescription,
  typeId: selectedId('Selecciona el tipo de incidencia.', 'El tipo de incidencia no es válido.'),
  priority: PriorityInput,
  dueDate: DueDate.optional(),
});
/** Alta de incidencia ya validada y normalizada (salida del esquema). */
export type CreateIncidentInput = z.infer<typeof CreateIncidentInput>;

/**
 * Cuerpo de `PATCH /api/incidents/:id` (CA-03.9): uno o varios de `title`, `description`,
 * `priority` y `dueDate` (`null` la quita), con las validaciones del alta. El tipo, el estado, el
 * asignado y los demás campos del servidor se descartan.
 */
export const UpdateIncidentInput = z
  .object({
    title: IncidentTitle.optional(),
    description: IncidentDescription.optional(),
    priority: PriorityInput.optional(),
    dueDate: DueDate.nullable().optional(),
  })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    error: 'Indica al menos un campo que cambiar.',
  });
/** Edición de incidencia ya validada y normalizada (salida del esquema). */
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInput>;

/**
 * Cuerpo de `POST /api/incidents/:id/assign` (CA-03.10). Que sea un usuario activo del
 * departamento propietario lo comprueba la API.
 */
export const AssignIncidentInput = z.object({
  assigneeId: selectedId('Selecciona a quién asignarla.', 'El usuario no es válido.'),
});
export type AssignIncidentInput = z.infer<typeof AssignIncidentInput>;

/**
 * *Query string* de `GET /api/incidents` (CA-03.7, CA-03.8). Llega como texto, así que `page` y
 * `assignedToMe` se convierten. Los filtros se combinan con Y y nunca amplían lo visible. Los
 * parámetros desconocidos se descartan.
 */
export const IncidentListQuery = z.object({
  status: z.enum(Status.options, { error: 'El estado no es válido.' }).optional(),
  priority: z.enum(Priority.options, { error: 'La prioridad no es válida.' }).optional(),
  departmentId: z.uuid('El departamento no es válido.').optional(),
  assignedToMe: z
    .enum(['true', 'false'], { error: 'El filtro "Asignadas a mí" no es válido.' })
    .transform((value) => value === 'true')
    .optional(),
  q: z
    .string({ error: 'La búsqueda no es válida.' })
    .trim()
    .max(
      INCIDENT_SEARCH_MAX_LENGTH,
      `La búsqueda no puede tener más de ${INCIDENT_SEARCH_MAX_LENGTH} caracteres.`,
    )
    // Un buscador vacío equivale a no buscar.
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  page: z.coerce
    // Una página vacía (`?page=`) no se convierte en 0: es un error, como cualquier otro texto.
    .number({ error: 'La página no es válida.' })
    .int('La página no es válida.')
    .min(1, 'La página no es válida.')
    .default(1),
});
/** Filtros y página del listado ya validados y convertidos (salida del esquema). */
export type IncidentListQuery = z.infer<typeof IncidentListQuery>;

/** Código de incidencia `INC-AAAA-NNNN` (4 cifras como mínimo). */
const IncidentCode = z.string().regex(/^INC-\d{4}-\d{4,}$/);

/** Campos comunes del listado y del detalle. */
const IncidentBase = z.object({
  id: z.uuid(),
  code: IncidentCode,
  title: z.string().min(1),
  type: IncidentTypeRef,
  department: DepartmentSummary,
  priority: Priority,
  status: Status,
  assignee: UserSummary.nullable(),
  dueDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
});

/** Elemento de `GET /api/incidents` (CA-03.7). No trae `allowedActions` (decisión 7 de F03). */
export const IncidentListItem = IncidentBase;
export type IncidentListItem = z.infer<typeof IncidentListItem>;

/** Respuesta paginada de `GET /api/incidents`. `total` cuenta solo las incidencias visibles. */
export const IncidentListResponse = z.object({
  items: z.array(IncidentListItem),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type IncidentListResponse = z.infer<typeof IncidentListResponse>;

/**
 * Detalle de una incidencia: respuesta de `GET /api/incidents/:id` y de todas sus mutaciones
 * (CA-03.6). `allowedActions` y `allowedTransitions` las calcula la `AuthorizationPolicy` para el
 * actor; la web solo las lee. `resolvedAt` y `closedAt` las rellena F04.
 */
export const Incident = IncidentBase.extend({
  description: z.string().min(1),
  createdBy: UserSummary,
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  allowedActions: z.array(IncidentAllowedAction),
  allowedTransitions: z.array(AllowedTransition),
});
export type Incident = z.infer<typeof Incident>;
