import { useEffect } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { buttonVariants, Icon, Link, Spinner, Text } from '../../components/atoms';
import { Alert } from '../../components/molecules';
import { IncidentAssignForm, IncidentLoadError, IncidentSummary } from '../../components/organisms';
import { useLocationNotice } from '../../app/location-notice';
import { INCIDENTS_PATH, incidentEditPath } from '../../app/paths';
import { ApiError } from '../../lib/api/client';
import { cn } from '../../lib/cn';
import { errorMessageOf } from '../../lib/api/error-messages';
import { useAssignIncident, useIncident, useIncidentAssignees } from '../../queries/incidents';

/**
 * Detalle de una incidencia (`/incidencias/:id`, CA-03.14 y CA-03.15), para cualquier usuario con
 * sesión que pueda verla (si no, la API responde 404).
 *
 * - `IncidentSummary` con los datos y, en su hueco de acciones, "Editar" solo si
 *   `incident.allowedActions` incluye `update`.
 * - `IncidentAssignForm` solo si incluye `assign` (y solo entonces se piden los candidatos). Al
 *   asignar, la respuesta de la API actualiza el resumen y el control muestra un aviso de éxito. El
 *   control se monta con `key` = asignado actual, para que tras asignar empiece con el nuevo.
 * - Aviso de éxito que deja el alta o la edición en `location.state`.
 * - La web no mira el rol: todo sale de `allowedActions`, que calcula la API.
 */
export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const incident = useIncident(id);
  const canAssign = incident.data?.allowedActions.includes('assign') ?? false;
  const assignees = useIncidentAssignees(id, { enabled: canAssign });
  const assign = useAssignIncident(id);
  const notice = useLocationNotice();

  // El aviso y el error de la asignación son de la incidencia y del asignado de ese momento: se
  // borran al cambiar de incidencia (la ruta reutiliza la página) y cuando el asignado actual ya no
  // es el de la última asignación (p. ej., otra persona la reasigna y llega al volver a pedirla).
  const { reset: resetAssign } = assign;
  const currentAssigneeId = incident.data?.assignee?.id ?? null;
  const lastAssignedId = assign.data?.assignee?.id;
  useEffect(() => {
    resetAssign();
  }, [id, resetAssign]);
  useEffect(() => {
    if (lastAssignedId !== undefined && lastAssignedId !== currentAssigneeId) resetAssign();
  }, [lastAssignedId, currentAssigneeId, resetAssign]);

  if (incident.isPending) return <Spinner label="Cargando la incidencia…" />;

  // Un fallo al volver a pedirla (p. ej. al recuperar el foco) no oculta lo que ya se ve, salvo que
  // la incidencia haya dejado de existir o de ser visible.
  const lostAccess = incident.error instanceof ApiError && incident.error.status === 404;
  if (incident.isError && (lostAccess || !incident.data)) {
    return (
      <IncidentLoadError
        notFound={lostAccess}
        title="Incidencia"
        errorMessage={errorMessageOf(incident.error)}
        backHref={INCIDENTS_PATH}
        linkAs={RouterLink}
      />
    );
  }
  const data = incident.data;
  if (!data) return null;

  const canUpdate = data.allowedActions.includes('update');
  const assignNotice =
    assign.isSuccess && assign.data.assignee && assign.data.assignee.id === currentAssigneeId
      ? `Incidencia asignada a ${assign.data.assignee.name}.`
      : undefined;
  const assignError = assign.error ?? assignees.error;

  return (
    <div className="flex flex-col gap-6">
      <Text variant="small">
        <Link as={RouterLink} to={INCIDENTS_PATH} className="inline-flex items-center gap-1">
          <Icon name="arrow-left" size="sm" />
          Volver al listado de incidencias
        </Link>
      </Text>
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <IncidentSummary
          className={canAssign ? 'lg:col-span-2' : 'lg:col-span-3'}
          incident={data}
          actions={
            canUpdate && (
              <Link
                as={RouterLink}
                to={incidentEditPath(data.id)}
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'no-underline hover:bg-neutral-bg hover:text-fg',
                )}
              >
                <Icon name="pencil" size="md" />
                Editar
              </Link>
            )
          }
        />
        {canAssign && (
          <IncidentAssignForm
            key={data.assignee?.id ?? 'sin-asignar'}
            assignees={assignees.data ?? []}
            currentAssigneeId={data.assignee?.id ?? null}
            onAssign={(assigneeId) => assign.mutate(assigneeId)}
            isPending={assign.isPending}
            isLoading={assignees.isPending}
            notice={assignNotice}
            errorMessage={assignError ? errorMessageOf(assignError) : undefined}
          />
        )}
      </div>
    </div>
  );
}
