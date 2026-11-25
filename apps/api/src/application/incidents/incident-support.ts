// Piezas comunes de los casos de uso de incidencias. Qué puede hacer cada actor lo decide siempre la
// `AuthorizationPolicy`; aquí solo se traduce a errores y a la respuesta.
import {
  IncidentAllowedAction,
  type CurrentUser,
  type Incident,
  type IncidentListItem,
} from '@incidapp/shared';
import {
  actorOf,
  canOnIncident,
  globalActionsFor,
  incidentActionsFor,
  type IncidentAccessFacts,
  type IncidentAction,
} from '../authorization/authorization-policy';
import { authorize } from '../authorization/authorize';
import type { IncidentRecord, IncidentRepository } from '../ports/incident-repository';

/** Hechos de la incidencia que deciden los permisos. */
export const accessFactsOf = (incident: IncidentRecord): IncidentAccessFacts => ({
  ownerDepartmentId: incident.department.id,
  createdById: incident.createdBy.id,
  assignedToId: incident.assignee?.id ?? null,
  status: incident.status,
});

/**
 * Exige que el actor pueda hacer `action` sobre la incidencia ya leída: 404 si no existe (también si
 * el id no era un UUID) o si no la ve (mismo error en los casos, CA-03.6); 403 si la ve pero no
 * puede hacer la acción.
 */
function authorizeOnIncident(
  actor: CurrentUser,
  incident: IncidentRecord | null,
  action: IncidentAction,
): IncidentRecord {
  const facts = incident ? accessFactsOf(incident) : null;
  const who = actorOf(actor);
  authorize({
    visible: facts !== null && canOnIncident(who, facts, 'view'),
    allowed: facts !== null && canOnIncident(who, facts, action),
  });
  return incident as IncidentRecord;
}

/** Lecturas (detalle, candidatos): carga la incidencia y la autoriza para `action`. */
export async function findIncidentForAction(
  incidents: IncidentRepository,
  actor: CurrentUser,
  id: string,
  action: IncidentAction,
): Promise<IncidentRecord> {
  return authorizeOnIncident(actor, await incidents.findById(id), action);
}

/**
 * Mutaciones: se llama **dentro** de `unitOfWork.run` con el repositorio de la transacción. Carga la
 * incidencia bloqueándola (`findByIdForUpdate`) y la autoriza para `action` sobre esa lectura; las
 * reglas y el *diff* del caso de uso también se calculan sobre ella. Así, entre la decisión y la
 * escritura nadie puede cambiar la incidencia (estado, asignado, campos): el `before` de los eventos
 * es exacto y una regla como "el Usuario solo edita en ABIERTA" no se puede saltar con una petición
 * concurrente. Lo reutilizan las transiciones de F04.
 */
export async function lockIncidentForAction(
  incidents: IncidentRepository,
  actor: CurrentUser,
  id: string,
  action: IncidentAction,
): Promise<IncidentRecord> {
  return authorizeOnIncident(actor, await incidents.findByIdForUpdate(id), action);
}

/** Solo quien tiene la acción global `createIncident` crea incidencias (CA-03.5): si no, 403. */
export function assertCanCreateIncident(actor: Pick<CurrentUser, 'role'>): void {
  authorize({ visible: true, allowed: globalActionsFor(actor).includes('createIncident') });
}

/**
 * Único sitio que construye el `Incident` de la API (detalle y respuesta de las mutaciones), con
 * las `allowedActions` del actor filtradas a las que expone el contrato. `allowedTransitions` la
 * rellena F04 aquí mismo.
 */
export function presentIncident(actor: CurrentUser, incident: IncidentRecord): Incident {
  const actions = incidentActionsFor(actorOf(actor), accessFactsOf(incident));
  return {
    ...presentIncidentListItem(incident),
    description: incident.description,
    createdBy: incident.createdBy,
    updatedAt: incident.updatedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    closedAt: incident.closedAt?.toISOString() ?? null,
    allowedActions: IncidentAllowedAction.options.filter((action) => actions.includes(action)),
    allowedTransitions: [],
  };
}

/** Elemento del listado: sin descripción ni acciones (decisión 7 de F03). */
export function presentIncidentListItem(incident: IncidentRecord): IncidentListItem {
  return {
    id: incident.id,
    code: incident.code,
    title: incident.title,
    type: incident.type,
    department: incident.department,
    priority: incident.priority,
    status: incident.status,
    assignee: incident.assignee,
    dueDate: incident.dueDate,
    createdAt: incident.createdAt.toISOString(),
  };
}
